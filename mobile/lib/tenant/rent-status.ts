import type { Database } from "@/lib/database.types";

type PaymentStatus = Database["public"]["Enums"]["payment_status"];
type VerificationStatus = Database["public"]["Enums"]["verification_status"];

export type RentStatusTone = "success" | "danger" | "pending";

export type RentStatusDisplay = {
  label: string;
  tone: RentStatusTone;
};

/**
 * Tenant-facing display status for one rent record, derived from its own
 * `payment_status` plus any related `rent_payments` submissions. Purely
 * presentational: it never touches `remaining_due`/`total_paid`/
 * `payment_status` itself, and never writes anything. The verification
 * workflow (the `review_rent_payment` RPC, run by an owner/manager) is the
 * only thing that ever changes those.
 *
 * Priority, matching what a tenant actually needs to know right now:
 *  1. a pending submission for this record -> "Pending verification"
 *     (amber/pending tone) — never shown alongside "Unpaid" for the same
 *     record, since this branch returns before the fallback below runs.
 *  2. a submission awaiting the tenant's correction -> "Correction requested"
 *     (amber/pending tone).
 *  3. otherwise, the record's own `payment_status` as already maintained by
 *     the verification workflow: "Paid" only once a verified payment fully
 *     covers the balance; a rejected/withdrawn/cancelled submission (or no
 *     submission at all) with a balance still due falls through to
 *     "Unpaid" (or "Partially paid" / "Overdue" when that's the record's
 *     actual state) here.
 */
export function deriveTenantRentStatus(
  record: { id: string; payment_status: PaymentStatus },
  payments: { rent_record_id: string; verification_status: VerificationStatus }[],
): RentStatusDisplay {
  const forRecord = payments.filter((payment) => payment.rent_record_id === record.id);

  if (forRecord.some((payment) => payment.verification_status === "pending")) {
    return { label: "Pending verification", tone: "pending" };
  }
  if (forRecord.some((payment) => payment.verification_status === "correction_requested")) {
    return { label: "Correction requested", tone: "pending" };
  }

  return {
    label: record.payment_status.replaceAll("_", " "),
    tone: record.payment_status === "paid" ? "success" : "danger",
  };
}
