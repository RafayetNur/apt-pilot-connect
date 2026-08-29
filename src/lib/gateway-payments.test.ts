import { describe, it, expect } from "vitest";

import {
  CHECKOUT_ACTIVE_WINDOW_MS,
  DEFAULT_VISIBLE_ATTEMPTS,
  latestPendingTransaction,
  recentPendingTransaction,
  type GatewayStatus,
  type GatewayTransaction,
} from "./gateway-payments";

const NOW = Date.parse("2026-08-29T06:00:00.000Z");

function txn(
  overrides: Partial<GatewayTransaction> & { status: GatewayStatus; minutesAgo: number },
): GatewayTransaction {
  const { minutesAgo, status, ...rest } = overrides;
  return {
    id: `id-${String(minutesAgo)}-${status}`,
    tran_id: `TRAN${String(minutesAgo)}`,
    rent_record_id: "bill-1",
    status,
    expected_amount: 25000,
    currency: "BDT",
    created_at: new Date(NOW - minutesAgo * 60_000).toISOString(),
    finalized_at: null,
    ...rest,
  };
}

describe("recentPendingTransaction", () => {
  it("blocks a new session while a pending attempt is under 15 minutes old", () => {
    const rows = [txn({ status: "pending", minutesAgo: 5 })];
    expect(recentPendingTransaction(rows, "bill-1", NOW)?.status).toBe("pending");
  });

  it("stops blocking once the pending attempt passes the active window", () => {
    const rows = [txn({ status: "pending", minutesAgo: 16 })];
    expect(recentPendingTransaction(rows, "bill-1", NOW)).toBeNull();
  });

  it("ignores pending attempts belonging to another bill", () => {
    const rows = [txn({ status: "pending", minutesAgo: 2, rent_record_id: "bill-2" })];
    expect(recentPendingTransaction(rows, "bill-1", NOW)).toBeNull();
  });

  it("never blocks on settled or terminal attempts", () => {
    const rows = [
      txn({ status: "paid", minutesAgo: 1 }),
      txn({ status: "review_required", minutesAgo: 2 }),
      txn({ status: "cancelled", minutesAgo: 3 }),
      txn({ status: "failed", minutesAgo: 4 }),
    ];
    expect(recentPendingTransaction(rows, "bill-1", NOW)).toBeNull();
  });
});

describe("latestPendingTransaction", () => {
  it("returns a stale pending row so the dashboard can re-check it", () => {
    const rows = [txn({ status: "pending", minutesAgo: 40 })];
    expect(latestPendingTransaction(rows, "bill-1")?.tran_id).toBe("TRAN40");
  });

  it("returns null when no pending attempt exists", () => {
    expect(latestPendingTransaction([txn({ status: "paid", minutesAgo: 1 })], "bill-1")).toBeNull();
  });
});

describe("display constants", () => {
  it("mirrors the server window and shows five attempts by default", () => {
    expect(CHECKOUT_ACTIVE_WINDOW_MS).toBe(15 * 60 * 1000);
    expect(DEFAULT_VISIBLE_ATTEMPTS).toBe(5);
  });
});

describe("isExpiredCloseable", () => {
  const now = Date.now();
  const row = (over: Partial<GatewayTransaction>) =>
    ({
      status: "pending",
      created_at: new Date(now - 20 * 60 * 1000).toISOString(),
      ...over,
    }) as GatewayTransaction;

  it("is closeable once a pending attempt passes the active window", () => {
    expect(isExpiredCloseable(row({}), now)).toBe(true);
  });

  it("is not closeable while the checkout is still active", () => {
    expect(
      isExpiredCloseable(row({ created_at: new Date(now - 60 * 1000).toISOString() }), now),
    ).toBe(false);
  });

  it("never offers to close a settled or terminal attempt", () => {
    for (const status of ["paid", "review_required", "failed", "cancelled"] as const) {
      expect(isExpiredCloseable(row({ status }), now)).toBe(false);
    }
  });

  it("ignores an unparseable timestamp", () => {
    expect(isExpiredCloseable(row({ created_at: "not-a-date" }), now)).toBe(false);
  });
});
