import { useCallback, useEffect } from "react";

import type { Database } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useAsyncState } from "@/lib/manager/shared";

/**
 * Manager review of tenant rent-payment submissions for assigned buildings.
 * Mirrors the web app's src/lib/payments.ts: same `rent_payments` select
 * with joins, same `review_rent_payment` RPC for verify/reject/correction
 * (never recomputes applied_amount/credit_amount client-side — that split is
 * entirely server-side), same payment-proofs bucket for signed URLs.
 */

export const PROOF_BUCKET = "payment-proofs";

export type PaymentMethod = Database["public"]["Enums"]["payment_method"];
export type VerificationStatus = Database["public"]["Enums"]["verification_status"];

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

export type ManagerPayment = {
  id: string;
  rent_record_id: string;
  building_id: string;
  building_name: string;
  flat_number: string;
  tenant_name: string;
  billing_month: string;
  amount_paid: number;
  payment_method: PaymentMethod;
  provider_name: string | null;
  transaction_reference: string | null;
  payment_proof_url: string | null;
  submitted_at: string;
  verification_status: VerificationStatus;
  reviewer_note: string | null;
};

const SELECT_WITH_JOINS =
  "id, rent_record_id, building_id, amount_paid, payment_method, provider_name, transaction_reference, payment_proof_url, submitted_at, verification_status, reviewer_note, buildings(name), flats(flat_number), tenant:profiles!rent_payments_tenant_id_fkey(full_name), rent_records!rent_payments_rent_record_id_fkey(billing_month)";

function normalize(raw: unknown): ManagerPayment {
  const row = raw as Record<string, unknown> & {
    buildings?: { name: string } | null;
    flats?: { flat_number: string } | null;
    tenant?: { full_name: string } | null;
    rent_records?: { billing_month: string } | null;
  };
  return {
    id: row["id"] as string,
    rent_record_id: row["rent_record_id"] as string,
    building_id: row["building_id"] as string,
    building_name: row.buildings?.name ?? "—",
    flat_number: row.flats?.flat_number ?? "—",
    tenant_name: row.tenant?.full_name ?? "—",
    billing_month: row.rent_records?.billing_month ?? "",
    amount_paid: Number(row["amount_paid"] ?? 0),
    payment_method: row["payment_method"] as PaymentMethod,
    provider_name: (row["provider_name"] as string | null) ?? null,
    transaction_reference: (row["transaction_reference"] as string | null) ?? null,
    payment_proof_url: (row["payment_proof_url"] as string | null) ?? null,
    submitted_at: row["submitted_at"] as string,
    verification_status: row["verification_status"] as VerificationStatus,
    reviewer_note: (row["reviewer_note"] as string | null) ?? null,
  };
}

export type PaymentStatusFilter = VerificationStatus | "all";

export function useManagerPayments(buildingId: string, status: PaymentStatusFilter) {
  const { session } = useAuth();
  const state = useAsyncState<ManagerPayment[]>([]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!session) return;
      if (isRefresh) state.setRefreshing(true);
      else state.setLoading(true);
      state.setError(null);

      let query = supabase.from("rent_payments").select(SELECT_WITH_JOINS).order("submitted_at", { ascending: false });
      if (buildingId && buildingId !== "all") query = query.eq("building_id", buildingId);
      if (status !== "all") query = query.eq("verification_status", status);

      const { data, error } = await query;
      if (!state.mountedRef.current) return;
      if (error) {
        state.setError(error.message);
        state.setLoading(false);
        state.setRefreshing(false);
        return;
      }
      state.setData((data ?? []).map(normalize));
      state.setLoading(false);
      state.setRefreshing(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, buildingId, status],
  );

  useEffect(() => {
    load();
  }, [load]);

  return { payments: state.data, loading: state.loading, refreshing: state.refreshing, error: state.error, refresh: () => load(true) };
}

function friendlyError(message: string): Error {
  const lower = message.toLowerCase();
  if (lower.includes("row-level security") || lower.includes("permission denied")) {
    return new Error("You are not allowed to review this payment.");
  }
  return new Error(message);
}

export type ReviewAction = "verify" | "reject" | "correction_requested";

/** Verifies, rejects, or requests correction on a submission. The server-side
 * RPC computes applied_amount / credit_amount and updates the rent record —
 * this function never derives those figures itself. */
export async function reviewPayment(paymentId: string, action: ReviewAction, note: string) {
  if (action !== "verify" && !note.trim()) {
    throw new Error("A reviewer note is required for this action.");
  }
  const trimmed = note.trim();
  const args = trimmed ? { _payment_id: paymentId, _action: action, _note: trimmed } : { _payment_id: paymentId, _action: action };
  const { error } = await supabase.rpc("review_rent_payment", args);
  if (error) throw friendlyError(error.message);
}

export async function createProofSignedUrl(path: string) {
  const { data, error } = await supabase.storage.from(PROOF_BUCKET).createSignedUrl(path, 60 * 10);
  if (error) throw new Error(`Could not open the payment proof: ${error.message}`);
  return data.signedUrl;
}
