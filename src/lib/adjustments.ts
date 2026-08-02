import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { PROOF_BUCKET } from "@/lib/payments";
import { monthToDate } from "@/lib/rent";

export type AdjustmentType = "debit" | "credit";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type AdjustmentCategory =
  | "electricity"
  | "gas"
  | "water"
  | "internet"
  | "shared_charge"
  | "flat_repair"
  | "correction"
  | "other";

export const adjustmentTypeLabel: Record<AdjustmentType, string> = {
  debit: "Debit (increases payable)",
  credit: "Credit (reduces payable)",
};

export const adjustmentCategoryLabel: Record<AdjustmentCategory, string> = {
  electricity: "Electricity",
  gas: "Gas",
  water: "Water",
  internet: "Internet",
  shared_charge: "Shared charge",
  flat_repair: "Flat repair",
  correction: "Correction",
  other: "Other",
};

export const adjustmentCategoryOptions = Object.keys(
  adjustmentCategoryLabel,
) as AdjustmentCategory[];

export const approvalStatusLabel: Record<ApprovalStatus, string> = {
  pending: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
};

export type BillAdjustment = {
  id: string;
  rent_record_id: string;
  building_id: string;
  flat_id: string;
  tenant_id: string;
  original_billing_month: string;
  posted_billing_month: string;
  adjustment_type: AdjustmentType;
  category: AdjustmentCategory;
  amount: number;
  reason: string;
  supporting_document_url: string | null;
  approval_status: ApprovalStatus;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  reviewer_note: string | null;
  created_at: string;
  updated_at: string;
};

export type AdjustmentRow = BillAdjustment & {
  building_name: string;
  flat_number: string;
  tenant_name: string;
  creator_name: string;
  reviewer_name: string;
};

function num(value: unknown) {
  return Number(value ?? 0);
}

const SELECT_WITH_JOINS =
  "*, buildings(name), flats(flat_number), tenant:profiles!bill_adjustments_tenant_id_fkey(full_name), creator:profiles!bill_adjustments_created_by_fkey(full_name), reviewer:profiles!bill_adjustments_approved_by_fkey(full_name)";

type RawAdjustment = Record<string, unknown> & {
  buildings?: { name: string } | null;
  flats?: { flat_number: string } | null;
  tenant?: { full_name: string } | null;
  creator?: { full_name: string } | null;
  reviewer?: { full_name: string } | null;
};

function normalize(raw: RawAdjustment): AdjustmentRow {
  return {
    ...(raw as unknown as BillAdjustment),
    amount: num(raw["amount"]),
    building_name: raw.buildings?.name ?? "—",
    flat_number: raw.flats?.flat_number ?? "—",
    tenant_name: raw.tenant?.full_name ?? "—",
    creator_name: raw.creator?.full_name ?? "—",
    reviewer_name: raw.reviewer?.full_name ?? "",
  };
}

export const adjustmentsQueryOptions = (buildingId: string, month: string) =>
  queryOptions({
    queryKey: ["bill-adjustments", buildingId, month],
    enabled: Boolean(buildingId) && Boolean(month),
    queryFn: async (): Promise<AdjustmentRow[]> => {
      const { data, error } = await supabase
        .from("bill_adjustments")
        .select(SELECT_WITH_JOINS)
        .eq("building_id", buildingId)
        .eq("posted_billing_month", monthToDate(month))
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => normalize(row as RawAdjustment));
    },
  });

export const myAdjustmentsQueryOptions = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["my-bill-adjustments", userId ?? "none"],
    enabled: Boolean(userId),
    queryFn: async (): Promise<AdjustmentRow[]> => {
      const { data, error } = await supabase
        .from("bill_adjustments")
        .select(SELECT_WITH_JOINS)
        .eq("tenant_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => normalize(row as RawAdjustment));
    },
  });

/** Billed flats of a building/month that an adjustment can be attached to. */
export type AdjustmentTarget = {
  rentRecordId: string;
  buildingId: string;
  flatId: string;
  flatNumber: string;
  tenantId: string;
  tenantName: string;
  billingMonth: string;
  totalPayable: number;
  totalPaid: number;
  remainingDue: number;
};

export const adjustmentTargetsQueryOptions = (buildingId: string, month: string) =>
  queryOptions({
    queryKey: ["adjustment-targets", buildingId, month],
    enabled: Boolean(buildingId) && Boolean(month),
    queryFn: async (): Promise<AdjustmentTarget[]> => {
      const { data, error } = await supabase
        .from("rent_records")
        .select(
          "id, building_id, flat_id, tenant_id, billing_month, total_payable, total_paid, remaining_due, flats(flat_number), profiles(full_name)",
        )
        .eq("building_id", buildingId)
        .eq("billing_month", monthToDate(month));
      if (error) throw error;
      return (data ?? [])
        .map((raw) => {
          const row = raw as Record<string, unknown> & {
            flats?: { flat_number: string } | null;
            profiles?: { full_name: string } | null;
          };
          return {
            rentRecordId: row["id"] as string,
            buildingId: row["building_id"] as string,
            flatId: row["flat_id"] as string,
            flatNumber: row.flats?.flat_number ?? "—",
            tenantId: row["tenant_id"] as string,
            tenantName: row.profiles?.full_name ?? "—",
            billingMonth: row["billing_month"] as string,
            totalPayable: num(row["total_payable"]),
            totalPaid: num(row["total_paid"]),
            remainingDue: num(row["remaining_due"]),
          } satisfies AdjustmentTarget;
        })
        .sort((a, b) => a.flatNumber.localeCompare(b.flatNumber, undefined, { numeric: true }));
    },
  });

async function uploadSupportingDocument(userId: string, file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/adjustments/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(PROOF_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error(`Could not upload the supporting document: ${error.message}`);
  return path;
}

export type CreateAdjustmentInput = {
  target: AdjustmentTarget;
  postedMonth: string; // yyyy-MM
  adjustmentType: AdjustmentType;
  category: AdjustmentCategory;
  amount: number;
  reason: string;
  documentFile: File | null;
};

export async function createAdjustment(input: CreateAdjustmentInput) {
  if (!(input.amount > 0)) throw new Error("Adjustment amount must be greater than zero.");
  if (!input.reason.trim()) throw new Error("A reason is required for every adjustment.");

  const { data: auth } = await supabase.auth.getUser();
  const createdBy = auth.user?.id;
  if (!createdBy) throw new Error("You must be signed in to create an adjustment.");

  const documentPath = input.documentFile
    ? await uploadSupportingDocument(createdBy, input.documentFile)
    : null;

  const { error } = await supabase.from("bill_adjustments").insert({
    rent_record_id: input.target.rentRecordId,
    building_id: input.target.buildingId,
    flat_id: input.target.flatId,
    tenant_id: input.target.tenantId,
    original_billing_month: input.target.billingMonth,
    posted_billing_month: monthToDate(input.postedMonth),
    adjustment_type: input.adjustmentType,
    category: input.category,
    amount: input.amount,
    reason: input.reason.trim(),
    supporting_document_url: documentPath,
    created_by: createdBy,
  });
  if (error) throw new Error(error.message);
}

export type AdjustmentReviewAction = "approve" | "reject";

export async function reviewAdjustment(
  adjustmentId: string,
  action: AdjustmentReviewAction,
  note: string,
) {
  if (action === "reject" && !note.trim()) {
    throw new Error("A reviewer note is required when rejecting an adjustment.");
  }
  const trimmed = note.trim();
  const { error } = await supabase.rpc("review_bill_adjustment", {
    _adjustment_id: adjustmentId,
    _action: action,
    ...(trimmed ? { _note: trimmed } : {}),
  });
  if (error) throw new Error(error.message);
}

export async function createDocumentSignedUrl(path: string) {
  const { data, error } = await supabase.storage.from(PROOF_BUCKET).createSignedUrl(path, 60 * 10);
  if (error) throw new Error(`Could not open the supporting document: ${error.message}`);
  return data.signedUrl;
}

/** Signed net effect of a list of adjustments (debit positive, credit negative). */
export function netAdjustment(rows: Array<Pick<BillAdjustment, "adjustment_type" | "amount">>) {
  return rows.reduce(
    (sum, row) => sum + (row.adjustment_type === "debit" ? row.amount : -row.amount),
    0,
  );
}
