import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const PROOF_BUCKET = "payment-proofs";

export type PaymentMethod = "bkash" | "nagad" | "bank_transfer" | "cash";
export type VerificationStatus =
  "pending" | "verified" | "rejected" | "correction_requested" | "withdrawn" | "cancelled";

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  bkash: "bKash",
  nagad: "Nagad",
  bank_transfer: "Bank transfer",
  cash: "Cash",
};

export const verificationStatusLabel: Record<VerificationStatus, string> = {
  pending: "Pending verification",
  verified: "Verified",
  rejected: "Rejected",
  correction_requested: "Correction requested",
  withdrawn: "Withdrawn by tenant",
  cancelled: "Cancelled by reviewer",
};

export function isDigitalMethod(method: PaymentMethod) {
  return method !== "cash";
}

export type RentPayment = {
  id: string;
  rent_record_id: string;
  building_id: string;
  flat_id: string;
  tenant_id: string;
  amount_paid: number;
  payment_method: PaymentMethod;
  provider_name: string | null;
  transaction_reference: string | null;
  payment_proof_url: string | null;
  submitted_at: string;
  verification_status: VerificationStatus;
  verified_by: string | null;
  verified_at: string | null;
  reviewer_note: string | null;
  applied_amount: number;
  credit_amount: number;
  receipt_number: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentRow = RentPayment & {
  building_name: string;
  flat_number: string;
  tenant_name: string;
  tenant_email: string;
  tenant_phone: string;
  reviewer_name: string;
  billing_month: string;
  base_rent: number;
  record_total_paid: number;
  record_remaining_due: number;
};

export type TenantCredit = {
  id: string;
  tenant_id: string;
  building_id: string;
  flat_id: string;
  amount: number;
  source_payment_id: string | null;
  remaining_amount: number;
  created_at: string;
  updated_at: string;
};

const SELECT_WITH_JOINS =
  "*, buildings(name), flats(flat_number), tenant:profiles!rent_payments_tenant_id_fkey(full_name, email, phone), reviewer:profiles!rent_payments_verified_by_fkey(full_name), rent_records(billing_month, base_rent, total_paid, remaining_due)";

type RawPaymentRow = Record<string, unknown> & {
  buildings?: { name: string } | null;
  flats?: { flat_number: string } | null;
  tenant?: { full_name: string; email: string; phone: string } | null;
  reviewer?: { full_name: string } | null;
  rent_records?: {
    billing_month: string;
    base_rent: number | string;
    total_paid: number | string;
    remaining_due: number | string;
  } | null;
};

function normalize(row: RawPaymentRow): PaymentRow {
  const record = row.rent_records ?? null;
  return {
    ...(row as unknown as RentPayment),
    amount_paid: Number(row["amount_paid"] ?? 0),
    applied_amount: Number(row["applied_amount"] ?? 0),
    credit_amount: Number(row["credit_amount"] ?? 0),
    building_name: row.buildings?.name ?? "—",
    flat_number: row.flats?.flat_number ?? "—",
    tenant_name: row.tenant?.full_name ?? "—",
    tenant_email: row.tenant?.email ?? "",
    tenant_phone: row.tenant?.phone ?? "",
    reviewer_name: row.reviewer?.full_name ?? "",
    billing_month: record?.billing_month ?? "",
    base_rent: Number(record?.base_rent ?? 0),
    record_total_paid: Number(record?.total_paid ?? 0),
    record_remaining_due: Number(record?.remaining_due ?? 0),
  };
}

export type PaymentFilters = {
  buildingId: string; // "all"
  status: VerificationStatus | "all";
};

export const reviewPaymentsQueryOptions = (filters: PaymentFilters) =>
  queryOptions({
    queryKey: ["rent-payments", filters.buildingId, filters.status],
    queryFn: async (): Promise<PaymentRow[]> => {
      let query = supabase
        .from("rent_payments")
        .select(SELECT_WITH_JOINS)
        .order("submitted_at", { ascending: false });

      if (filters.buildingId !== "all") query = query.eq("building_id", filters.buildingId);
      if (filters.status !== "all") query = query.eq("verification_status", filters.status);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row) => normalize(row as RawPaymentRow));
    },
  });

export const myPaymentsQueryOptions = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["my-rent-payments", userId ?? "none"],
    enabled: Boolean(userId),
    queryFn: async (): Promise<PaymentRow[]> => {
      const { data, error } = await supabase
        .from("rent_payments")
        .select(SELECT_WITH_JOINS)
        .eq("tenant_id", userId!)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => normalize(row as RawPaymentRow));
    },
  });

export const myCreditsQueryOptions = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["my-tenant-credits", userId ?? "none"],
    enabled: Boolean(userId),
    queryFn: async (): Promise<TenantCredit[]> => {
      const { data, error } = await supabase
        .from("tenant_credits")
        .select("*")
        .eq("tenant_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...(row as unknown as TenantCredit),
        amount: Number((row as Record<string, unknown>)["amount"] ?? 0),
        remaining_amount: Number((row as Record<string, unknown>)["remaining_amount"] ?? 0),
      }));
    },
  });

export const buildingCreditsQueryOptions = (buildingId: string) =>
  queryOptions({
    queryKey: ["building-credits", buildingId],
    queryFn: async (): Promise<TenantCredit[]> => {
      let query = supabase.from("tenant_credits").select("*");
      if (buildingId !== "all") query = query.eq("building_id", buildingId);
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TenantCredit[];
    },
  });

function friendlyError(message: string): Error {
  const lower = message.toLowerCase();
  if (lower.includes("rent_payments_one_pending_per_record")) {
    return new Error("A payment submission for this month is already pending verification.");
  }
  if (lower.includes("rent_payments_digital_requires_details")) {
    return new Error("Digital payments need a provider name and a transaction reference.");
  }
  if (lower.includes("amount_paid")) {
    return new Error("Amount paid must be greater than zero.");
  }
  return new Error(message);
}

export type SubmitPaymentInput = {
  rentRecordId: string;
  buildingId: string;
  flatId: string;
  tenantId: string;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  providerName: string;
  transactionReference: string;
  proofFile: File | null;
};

async function uploadProof(tenantId: string, file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${tenantId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(PROOF_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error(`Could not upload the payment proof: ${error.message}`);
  return path;
}

export async function submitTenantPayment(input: SubmitPaymentInput) {
  if (!(input.amountPaid > 0)) throw new Error("Amount paid must be greater than zero.");
  if (input.paymentMethod === "cash") {
    throw new Error("Cash payments must be recorded by your owner or manager.");
  }
  if (!input.providerName.trim() || !input.transactionReference.trim()) {
    throw new Error("Provider name and transaction reference are required.");
  }
  if (!input.proofFile) throw new Error("A payment proof image is required.");

  const proofPath = await uploadProof(input.tenantId, input.proofFile);

  const { error } = await supabase.from("rent_payments").insert({
    rent_record_id: input.rentRecordId,
    building_id: input.buildingId,
    flat_id: input.flatId,
    tenant_id: input.tenantId,
    amount_paid: input.amountPaid,
    payment_method: input.paymentMethod,
    provider_name: input.providerName.trim(),
    transaction_reference: input.transactionReference.trim(),
    payment_proof_url: proofPath,
  });
  if (error) throw friendlyError(error.message);
}

export type CashPaymentInput = {
  rentRecordId: string;
  buildingId: string;
  flatId: string;
  tenantId: string;
  amountPaid: number;
  note: string;
};

export async function recordCashPayment(input: CashPaymentInput) {
  if (!(input.amountPaid > 0)) throw new Error("Amount paid must be greater than zero.");
  const { error } = await supabase.from("rent_payments").insert({
    rent_record_id: input.rentRecordId,
    building_id: input.buildingId,
    flat_id: input.flatId,
    tenant_id: input.tenantId,
    amount_paid: input.amountPaid,
    payment_method: "cash",
    provider_name: input.note.trim() || null,
  });
  if (error) throw friendlyError(error.message);
}

export type ReviewAction = "verify" | "reject" | "correction_requested";

export async function reviewPayment(paymentId: string, action: ReviewAction, note: string) {
  if (action !== "verify" && !note.trim()) {
    throw new Error("A reviewer note is required for this action.");
  }
  const trimmed = note.trim();
  const args = trimmed
    ? { _payment_id: paymentId, _action: action, _note: trimmed }
    : { _payment_id: paymentId, _action: action };
  const { error } = await supabase.rpc("review_rent_payment", args);
  if (error) throw friendlyError(error.message);
}

/**
 * A pending submission can be withdrawn by its own tenant, or cancelled by the
 * owner / assigned manager with a reason. The row and its proof are kept.
 */
export async function withdrawPayment(paymentId: string, reason: string) {
  const trimmed = reason.trim();
  const { error } = await supabase.rpc("withdraw_rent_payment", {
    _payment_id: paymentId,
    ...(trimmed ? { _reason: trimmed } : {}),
  });
  if (error) throw friendlyError(error.message);
}

export async function createProofSignedUrl(path: string) {
  const { data, error } = await supabase.storage.from(PROOF_BUCKET).createSignedUrl(path, 60 * 10);
  if (error) throw new Error(`Could not open the payment proof: ${error.message}`);
  return data.signedUrl;
}

export function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
