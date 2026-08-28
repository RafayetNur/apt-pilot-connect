import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

/**
 * SSLCOMMERZ payment backend.
 *
 * Security model:
 * - Secrets (SSLCOMMERZ_STORE_ID / SSLCOMMERZ_STORE_PASSWORD) are read only
 *   inside handlers and are never logged, returned or echoed.
 * - The client supplies nothing but a rent record id; tenant, flat, building,
 *   amount and currency are all derived server-side from the database.
 * - A redirect (success/fail/cancel) never changes money. Only the IPN route,
 *   after a server-to-server Validation API call, finalizes a payment.
 */

const LIVE_SESSION_URL = "https://securepay.sslcommerz.com/gwprocess/v4/api.php";
const LIVE_VALIDATION_URL =
  "https://securepay.sslcommerz.com/validator/api/validationserverAPI.php";
const SANDBOX_SESSION_URL = "https://sandbox.sslcommerz.com/gwprocess/v4/api.php";
const SANDBOX_VALIDATION_URL =
  "https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php";

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_BODY_BYTES = 16_384;

/** Documented live SSLCOMMERZ BDT bounds. */
export const MIN_GATEWAY_AMOUNT_BDT = 10;
export const MAX_GATEWAY_AMOUNT_BDT = 500000;

const ALLOWED_ORIGIN_SUFFIXES = [".lovable.app", ".lovableproject.com"];
const ALLOWED_ORIGIN_EXACT = ["http://localhost:8080", "http://localhost:8081"];

export function resolveCorsHeaders(
  request: Request,
  methods = "POST, OPTIONS",
): Record<string, string> {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  // Native Expo sends no Origin header.
  if (!origin) return headers;
  let allowed = ALLOWED_ORIGIN_EXACT.includes(origin);
  if (!allowed) {
    try {
      const host = new URL(origin).hostname;
      allowed = ALLOWED_ORIGIN_SUFFIXES.some((suffix) => host.endsWith(suffix));
    } catch {
      allowed = false;
    }
  }
  if (allowed) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

export function jsonResponse(
  body: unknown,
  status: number,
  cors: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...cors },
  });
}

function isLive(): boolean {
  const raw = (process.env["SSLCOMMERZ_IS_LIVE"] ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

export function sessionUrl(): string {
  return isLive() ? LIVE_SESSION_URL : SANDBOX_SESSION_URL;
}

export function validationUrl(): string {
  return isLive() ? LIVE_VALIDATION_URL : SANDBOX_VALIDATION_URL;
}

function credentials(): { storeId: string; storePassword: string } | null {
  const storeId = process.env["SSLCOMMERZ_STORE_ID"];
  const storePassword = process.env["SSLCOMMERZ_STORE_PASSWORD"];
  if (!storeId || !storePassword) return null;
  return { storeId, storePassword };
}

export function callbackBase(): string {
  return (
    process.env["SSLCOMMERZ_CALLBACK_BASE_URL"] ?? "https://apt-pilot-connect.lovable.app"
  ).replace(/\/+$/, "");
}

/** SSLCOMMERZ allows up to 30 chars for tran_id. */
export function newTransactionId(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase();
  return `APT${stamp}${rand}`.slice(0, 30);
}

async function readLimitedText(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return null;
  return text;
}

export async function readForm(request: Request): Promise<Record<string, string> | null> {
  const text = await readLimitedText(request);
  if (text === null) return null;
  const contentType = request.headers.get("content-type") ?? "";
  const out: Record<string, string> = {};
  if (contentType.includes("application/json")) {
    try {
      const parsed: unknown = JSON.parse(text || "{}");
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === "string" || typeof value === "number") out[key] = String(value);
      }
      return out;
    } catch {
      return null;
    }
  }
  for (const [key, value] of new URLSearchParams(text)) out[key] = value;
  return out;
}

export async function readJson(request: Request): Promise<unknown | null> {
  const text = await readLimitedText(request);
  if (text === null) return null;
  try {
    return JSON.parse(text || "{}") as unknown;
  } catch {
    return null;
  }
}

/** Verifies the Supabase bearer token and returns an RLS-scoped client. */
export async function authenticate(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer "))
    return { error: "Authentication required." };
  const token = authHeader.slice("Bearer ".length).trim();
  if (token.split(".").length !== 3) return { error: "Authentication required." };

  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return { error: "Authentication is not available right now." };

  const supabase = createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${token}`, apikey: key } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return { error: "Authentication required." };
  return { userId: data.claims.sub as string, supabase };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TRAN_ID_RE = /^[A-Z0-9]{6,30}$/;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function isTranId(value: unknown): value is string {
  return typeof value === "string" && TRAN_ID_RE.test(value);
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Initiate                                                            */
/* ------------------------------------------------------------------ */

export async function handleInitiate(request: Request): Promise<Response> {
  const cors = resolveCorsHeaders(request);

  const auth = await authenticate(request);
  if ("error" in auth) return jsonResponse({ ok: false, error: auth.error }, 401, cors);

  const body = await readJson(request);
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse({ ok: false, error: "Invalid request body." }, 400, cors);
  }
  const rentRecordId = (body as Record<string, unknown>)["rentRecordId"];
  if (!isUuid(rentRecordId)) {
    return jsonResponse({ ok: false, error: "A valid rent record id is required." }, 400, cors);
  }

  const creds = credentials();
  if (!creds) {
    return jsonResponse({ ok: false, error: "Online payment is not configured." }, 503, cors);
  }

  // RLS-scoped read: a tenant can only see their own rent record.
  const { data: record, error } = await auth.supabase
    .from("rent_records")
    .select("id, tenant_id, building_id, flat_id, remaining_due, billing_month")
    .eq("id", rentRecordId)
    .maybeSingle();

  if (error) return jsonResponse({ ok: false, error: "Could not load the bill." }, 500, cors);
  if (!record || record.tenant_id !== auth.userId) {
    return jsonResponse({ ok: false, error: "Bill not found." }, 404, cors);
  }

  const amount = Math.round(Number(record.remaining_due ?? 0) * 100) / 100;
  if (!(amount > 0)) {
    return jsonResponse({ ok: false, error: "This bill has nothing due." }, 400, cors);
  }
  if (amount < MIN_GATEWAY_AMOUNT_BDT) {
    return jsonResponse(
      {
        ok: false,
        error: `Online payment needs at least BDT ${MIN_GATEWAY_AMOUNT_BDT.toFixed(2)}. Please use another payment method.`,
      },
      400,
      cors,
    );
  }
  if (amount > MAX_GATEWAY_AMOUNT_BDT) {
    return jsonResponse(
      {
        ok: false,
        error: `Online payment supports at most BDT ${MAX_GATEWAY_AMOUNT_BDT.toFixed(2)} per transaction. Please use another payment method.`,
      },
      400,
      cors,
    );
  }

  const { data: profile } = await auth.supabase
    .from("profiles")
    .select("full_name, email, phone")
    .eq("id", auth.userId)
    .maybeSingle();

  const tranId = newTransactionId();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Store the pending attempt BEFORE contacting the gateway.
  const { error: insertError } = await supabaseAdmin.from("sslcommerz_transactions").insert({
    tran_id: tranId,
    rent_record_id: record.id,
    tenant_id: record.tenant_id,
    building_id: record.building_id,
    flat_id: record.flat_id,
    expected_amount: amount,
    currency: "BDT",
    status: "pending",
  });
  if (insertError) {
    return jsonResponse({ ok: false, error: "Could not start the payment." }, 500, cors);
  }

  const base = callbackBase();
  const form = new URLSearchParams({
    store_id: creds.storeId,
    store_passwd: creds.storePassword,
    total_amount: amount.toFixed(2),
    currency: "BDT",
    tran_id: tranId,
    success_url: `${base}/api/public/payments/sslcommerz/success`,
    fail_url: `${base}/api/public/payments/sslcommerz/fail`,
    cancel_url: `${base}/api/public/payments/sslcommerz/cancel`,
    ipn_url: `${base}/api/public/payments/sslcommerz/ipn`,
    shipping_method: "NO",
    product_name: "Apartment rent",
    product_category: "Rent",
    product_profile: "non-physical-goods",
    num_of_item: "1",
    cus_name: (profile?.full_name ?? "AptPilot tenant").slice(0, 100),
    cus_email: (profile?.email ?? "").slice(0, 100),
    cus_phone: (profile?.phone ?? "").slice(0, 20),
    cus_add1: "N/A",
    cus_city: "N/A",
    cus_country: "Bangladesh",
  });

  let payload: Record<string, unknown>;
  try {
    const response = await fetchWithTimeout(sessionUrl(), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    await supabaseAdmin
      .from("sslcommerz_transactions")
      .update({ status: "failed", failure_reason: "session_request_failed" })
      .eq("tran_id", tranId)
      .eq("status", "pending");
    return jsonResponse({ ok: false, error: "Payment service is unavailable." }, 502, cors);
  }

  const gatewayUrl = typeof payload["GatewayPageURL"] === "string" ? payload["GatewayPageURL"] : "";
  if (payload["status"] !== "SUCCESS" || !gatewayUrl) {
    await supabaseAdmin
      .from("sslcommerz_transactions")
      .update({ status: "failed", failure_reason: "session_rejected" })
      .eq("tran_id", tranId)
      .eq("status", "pending");
    return jsonResponse({ ok: false, error: "Could not start the payment." }, 502, cors);
  }

  if (typeof payload["sessionkey"] === "string") {
    await supabaseAdmin
      .from("sslcommerz_transactions")
      .update({ sessionkey: payload["sessionkey"] })
      .eq("tran_id", tranId);
  }

  return jsonResponse({ ok: true, transactionId: tranId, gatewayUrl, amount }, 200, cors);
}

/* ------------------------------------------------------------------ */
/* IPN + validation                                                    */
/* ------------------------------------------------------------------ */

type ValidationResult =
  | { outcome: "valid"; amount: number; currency: string; bankTranId: string; risky: boolean }
  /** Money did not match exactly — never credited, held for human review. */
  | { outcome: "review"; reason: string; amount: number | null; bankTranId: string }
  | { outcome: "invalid"; reason: string };

/** Two-decimal money parser: rejects missing, non-numeric or over-precise values. */
export function parseMoneyToCents(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim();
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(raw)) return null;
  const cents = Math.round(Number(raw) * 100);
  if (!Number.isFinite(cents) || cents <= 0) return null;
  return cents;
}

export async function validateWithGateway(
  valId: string,
  tranId: string,
  expectedAmount: number,
): Promise<ValidationResult> {
  const creds = credentials();
  if (!creds) return { outcome: "invalid", reason: "unconfigured" };


  const url = new URL(validationUrl());
  url.searchParams.set("val_id", valId);
  url.searchParams.set("store_id", creds.storeId);
  url.searchParams.set("store_passwd", creds.storePassword);
  url.searchParams.set("format", "json");

  let payload: Record<string, unknown>;
  try {
    const response = await fetchWithTimeout(url.toString(), { method: "GET" });
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    return { outcome: "invalid", reason: "validation_unreachable" };
  }
  return interpretValidation(payload, tranId, expectedAmount);
}

/** Pure comparison step — unit-testable without touching the gateway. */
export function interpretValidation(
  payload: Record<string, unknown>,
  tranId: string,
  expectedAmount: number,
): ValidationResult {
  const status = typeof payload["status"] === "string" ? payload["status"] : "";
  if (status !== "VALID" && status !== "VALIDATED") {
    return { outcome: "invalid", reason: "not_valid" };
  }
  if (payload["tran_id"] !== tranId) {
    return { outcome: "invalid", reason: "tran_id_mismatch" };
  }
  const currency = typeof payload["currency"] === "string" ? payload["currency"] : "";
  if (currency !== "BDT") return { outcome: "invalid", reason: "currency_mismatch" };

  const bankTranId = typeof payload["bank_tran_id"] === "string" ? payload["bank_tran_id"] : tranId;
  const expectedCents = parseMoneyToCents(expectedAmount.toFixed(2));
  if (expectedCents === null) {
    return { outcome: "review", reason: "expected_amount_invalid", amount: null, bankTranId };
  }

  // `amount` is the customer's gross payment. `store_amount` is the merchant's
  // net settlement after commission and must never be used as the rent amount.
  const grossCents = parseMoneyToCents(payload["amount"]);
  if (grossCents === null) {
    return { outcome: "review", reason: "gross_amount_invalid", amount: null, bankTranId };
  }
  if (grossCents !== expectedCents) {
    return {
      outcome: "review",
      reason: "amount_mismatch",
      amount: grossCents / 100,
      bankTranId,
    };
  }

  // Optional settlement-currency fields must agree when present.
  const currencyType = payload["currency_type"];
  if (currencyType !== undefined && currencyType !== null && currencyType !== "") {
    if (currencyType !== "BDT") {
      return {
        outcome: "review",
        reason: "currency_type_mismatch",
        amount: grossCents / 100,
        bankTranId,
      };
    }
    const currencyAmount = payload["currency_amount"];
    if (currencyAmount !== undefined && currencyAmount !== null && currencyAmount !== "") {
      const currencyCents = parseMoneyToCents(currencyAmount);
      if (currencyCents === null || currencyCents !== expectedCents) {
        return {
          outcome: "review",
          reason: "currency_amount_mismatch",
          amount: grossCents / 100,
          bankTranId,
        };
      }
    }
  }

  const risky = String(payload["risk_level"] ?? "0").trim() !== "0";
  return { outcome: "valid", amount: grossCents / 100, currency, bankTranId, risky };
}

export async function handleIpn(request: Request): Promise<Response> {
  const cors = resolveCorsHeaders(request);
  const form = await readForm(request);
  if (!form) return jsonResponse({ ok: false, error: "Invalid callback." }, 400, cors);

  const tranId = form["tran_id"];
  const valId = form["val_id"];
  if (!isTranId(tranId) || typeof valId !== "string" || valId.length < 4 || valId.length > 100) {
    return jsonResponse({ ok: false, error: "Invalid callback." }, 400, cors);
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: txn } = await supabaseAdmin
    .from("sslcommerz_transactions")
    .select("tran_id, status, expected_amount")
    .eq("tran_id", tranId)
    .maybeSingle();

  if (!txn) return jsonResponse({ ok: false, error: "Unknown transaction." }, 404, cors);
  // Terminal states only. A `failed`/`cancelled` row came from an informational
  // redirect, so a late server-validated IPN must still be able to settle it.
  if (txn.status === "paid" || txn.status === "review_required") {
    return jsonResponse({ ok: true, status: txn.status }, 200, cors);
  }

  const result = await validateWithGateway(valId, tranId, Number(txn.expected_amount));
  if (result.outcome === "invalid") {
    await supabaseAdmin
      .from("sslcommerz_transactions")
      .update({ status: "failed", failure_reason: result.reason, val_id: valId })
      .eq("tran_id", tranId)
      .in("status", ["pending", "failed", "cancelled"]);
    return jsonResponse({ ok: true, status: "failed" }, 200, cors);
  }
  if (result.outcome === "review") {
    await supabaseAdmin
      .from("sslcommerz_transactions")
      .update({
        status: "review_required",
        failure_reason: result.reason,
        val_id: valId,
        bank_tran_id: result.bankTranId,
        validated_amount: result.amount,
        finalized_at: new Date().toISOString(),
      })
      .eq("tran_id", tranId)
      .in("status", ["pending", "failed", "cancelled"]);
    return jsonResponse({ ok: true, status: "review_required" }, 200, cors);
  }

  const { data: status, error } = await supabaseAdmin.rpc("finalize_sslcommerz_payment", {
    _tran_id: tranId,
    _val_id: valId,
    _bank_tran_id: result.bankTranId,
    _validated_amount: result.amount,
    _currency: result.currency,
    _risky: result.risky,
  });
  if (error) return jsonResponse({ ok: false, error: "Could not finalize." }, 500, cors);

  return jsonResponse({ ok: true, status }, 200, cors);
}

/* ------------------------------------------------------------------ */
/* Redirect landings (never financial)                                 */
/* ------------------------------------------------------------------ */

export async function handleRedirectLanding(
  request: Request,
  kind: "success" | "fail" | "cancel",
): Promise<Response> {
  // Browser redirects are informational only: they are fully read-only with
  // respect to transaction status. Only the server-validated IPN path decides
  // whether a gateway attempt is paid, failed, cancelled or review_required.
  if (request.method === "POST") await readForm(request);


  const message =
    kind === "success"
      ? "Payment received. We are confirming it with the bank — your bill updates automatically once confirmed."
      : kind === "cancel"
        ? "Payment cancelled. Nothing was charged."
        : "Payment failed. Nothing was charged.";

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AptPilot payment</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#FDF8F4;color:#2E2A3B;font-family:system-ui,sans-serif;padding:24px}
.card{max-width:26rem;text-align:center;background:#fff;border:1px solid #e7ded5;border-radius:16px;padding:28px}
h1{font-size:1.15rem;margin:0 0 .5rem;color:#5E8C6A}p{margin:0;line-height:1.5;font-size:.95rem}</style>
</head><body><div class="card"><h1>AptPilot</h1><p>${message}</p></div></body></html>`;

  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

/* ------------------------------------------------------------------ */
/* Status                                                              */
/* ------------------------------------------------------------------ */

export async function handleStatus(request: Request): Promise<Response> {
  const cors = resolveCorsHeaders(request, "GET, OPTIONS");
  const auth = await authenticate(request);
  if ("error" in auth) return jsonResponse({ ok: false, error: auth.error }, 401, cors);

  const tranId = new URL(request.url).searchParams.get("transactionId") ?? "";
  if (!isTranId(tranId)) {
    return jsonResponse({ ok: false, error: "A valid transaction id is required." }, 400, cors);
  }

  // RLS restricts the row to the owning tenant (or an authorized reviewer).
  const { data, error } = await auth.supabase
    .from("sslcommerz_transactions")
    .select("tran_id, status, expected_amount, currency, rent_record_id, finalized_at")
    .eq("tran_id", tranId)
    .maybeSingle();

  if (error) return jsonResponse({ ok: false, error: "Could not load the payment." }, 500, cors);
  if (!data) return jsonResponse({ ok: false, error: "Transaction not found." }, 404, cors);

  return jsonResponse(
    {
      ok: true,
      transactionId: data.tran_id,
      status: data.status,
      amount: Number(data.expected_amount),
      currency: data.currency,
      rentRecordId: data.rent_record_id,
      finalizedAt: data.finalized_at,
    },
    200,
    cors,
  );
}
