import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type GatewayStatus = Database["public"]["Enums"]["gateway_txn_status"];

export type GatewayTransaction = {
  id: string;
  tran_id: string;
  rent_record_id: string;
  status: GatewayStatus;
  expected_amount: number;
  currency: string;
  created_at: string;
  finalized_at: string | null;
};

/** Tenant-facing labels. Only `paid` means money has actually settled. */
export const gatewayStatusLabel: Record<GatewayStatus, string> = {
  pending: "Processing",
  paid: "Paid",
  failed: "Failed",
  cancelled: "Cancelled",
  review_required: "Under review",
};

export const gatewayStatusVariant: Record<
  GatewayStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  paid: "default",
  failed: "destructive",
  cancelled: "outline",
  review_required: "outline",
};

/** Mirrors the server-side gateway bounds; the server is still authoritative. */
export const MIN_ONLINE_AMOUNT_BDT = 10;
export const MAX_ONLINE_AMOUNT_BDT = 500000;

export function isOnlineAmountEligible(remainingDue: number): boolean {
  return remainingDue >= MIN_ONLINE_AMOUNT_BDT && remainingDue <= MAX_ONLINE_AMOUNT_BDT;
}

/**
 * Exact hostnames this integration is allowed to hand the browser to.
 * Both are official SSLCOMMERZ live hosts: the v4 gateway process host and the
 * hosted checkout host that live GatewayPageURL links point at. Sandbox hosts
 * are deliberately absent. Exact equality only — no wildcards, no suffixes.
 */
const ALLOWED_GATEWAY_HOSTS = ["securepay.sslcommerz.com", "seamless-epay.sslcommerz.com"];

export function isAllowedGatewayUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return false;
  }
  return url.protocol === "https:" && ALLOWED_GATEWAY_HOSTS.includes(url.hostname.toLowerCase());
}

export class SessionExpiredError extends Error {
  constructor() {
    super("Your session has expired. Please sign in again.");
    this.name = "SessionExpiredError";
  }
}

export type InitiateResult = { transactionId: string; gatewayUrl: string; amount: number };

/**
 * POST /api/public/payments/sslcommerz/initiate
 * Request body carries the rent record id only — every monetary and identity
 * field is derived server-side.
 */
export async function initiateOnlinePayment(rentRecordId: string): Promise<InitiateResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new SessionExpiredError();

  const response = await fetch("/api/public/payments/sslcommerz/initiate", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ rentRecordId }),
  });

  if (response.status === 401) throw new SessionExpiredError();

  let payload: Record<string, unknown> = {};
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    payload = {};
  }

  if (!response.ok || payload["ok"] !== true) {
    const safeMessage =
      response.status === 400 && typeof payload["error"] === "string"
        ? payload["error"]
        : "Online payment could not be started. Please try again or submit a manual payment.";
    throw new Error(safeMessage);
  }

  const gatewayUrl = payload["gatewayUrl"];
  const transactionId = payload["transactionId"];
  if (!isAllowedGatewayUrl(gatewayUrl) || typeof transactionId !== "string") {
    throw new Error("The payment link was not recognised, so it was blocked for your safety.");
  }

  return {
    transactionId,
    gatewayUrl,
    amount: typeof payload["amount"] === "number" ? payload["amount"] : 0,
  };
}

/** GET /api/public/payments/sslcommerz/status?transactionId=… (authenticated). */
export async function fetchGatewayStatus(transactionId: string): Promise<GatewayStatus> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new SessionExpiredError();

  const response = await fetch(
    `/api/public/payments/sslcommerz/status?transactionId=${encodeURIComponent(transactionId)}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (response.status === 401) throw new SessionExpiredError();

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const status = payload["status"];
  if (payload["ok"] !== true || typeof status !== "string") {
    throw new Error("Could not check the payment status right now.");
  }
  return status as GatewayStatus;
}

export function myGatewayTransactionsQueryOptions() {
  return queryOptions({
    queryKey: ["gateway-transactions"],
    queryFn: async (): Promise<GatewayTransaction[]> => {
      const { data, error } = await supabase
        .from("sslcommerz_transactions")
        .select(
          "id, tran_id, rent_record_id, status, expected_amount, currency, created_at, finalized_at",
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return (data ?? []) as GatewayTransaction[];
    },
  });
}

const RECENT_PENDING_WINDOW_MS = 15 * 60 * 1000;

/** A very recent pending attempt blocks a second one to avoid duplicate sessions. */
export function recentPendingTransaction(
  transactions: GatewayTransaction[],
  rentRecordId: string,
): GatewayTransaction | null {
  const now = Date.now();
  return (
    transactions.find(
      (item) =>
        item.rent_record_id === rentRecordId &&
        item.status === "pending" &&
        now - new Date(item.created_at).getTime() < RECENT_PENDING_WINDOW_MS,
    ) ?? null
  );
}
