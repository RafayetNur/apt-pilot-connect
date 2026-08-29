import { describe, it, expect } from "vitest";
import {
  validateGatewayPageUrl,
  extractGatewayHostname,
  isStaleCheckout,
  CHECKOUT_ACTIVE_WINDOW_MS,
  CHECKOUT_EXPIRED_REASON,
} from "./sslcommerz.server";

describe("validateGatewayPageUrl", () => {
  it("accepts the three official live HTTPS hosts", () => {
    expect(
      validateGatewayPageUrl("https://securepay.sslcommerz.com/gwprocess/v4/gw/index.php"),
    ).toBe(true);
    expect(validateGatewayPageUrl("https://seamless-epay.sslcommerz.com/pay?token=abc")).toBe(true);
    expect(validateGatewayPageUrl("https://epay-gw.sslcommerz.com/pay?token=abc")).toBe(true);
  });

  it("rejects HTTP for all allowed hosts", () => {
    expect(validateGatewayPageUrl("http://securepay.sslcommerz.com/gwprocess/v4/api.php")).toBe(
      false,
    );
    expect(validateGatewayPageUrl("http://seamless-epay.sslcommerz.com/pay")).toBe(false);
    expect(validateGatewayPageUrl("http://epay-gw.sslcommerz.com/pay")).toBe(false);
  });

  it("rejects arbitrary subdomains of allowed hosts", () => {
    expect(validateGatewayPageUrl("https://sub.securepay.sslcommerz.com/pay")).toBe(false);
    expect(validateGatewayPageUrl("https://sub.seamless-epay.sslcommerz.com/pay")).toBe(false);
    expect(validateGatewayPageUrl("https://sub.epay-gw.sslcommerz.com/pay")).toBe(false);
  });

  it("rejects suffix-matched lookalike domains", () => {
    expect(validateGatewayPageUrl("https://epay-gw.sslcommerz.com.evil.io/pay")).toBe(false);
    expect(validateGatewayPageUrl("https://securepay.sslcommerz.com.evil.io/pay")).toBe(false);
  });

  it("rejects sandbox hostnames", () => {
    expect(validateGatewayPageUrl("https://sandbox.sslcommerz.com/gwprocess/v4/api.php")).toBe(
      false,
    );
    expect(validateGatewayPageUrl("https://sandbox.sslcommerz.com/pay")).toBe(false);
  });

  it("rejects non-HTTPS and non-URL values", () => {
    expect(validateGatewayPageUrl("javascript:alert(1)")).toBe(false);
    expect(validateGatewayPageUrl("ftp://securepay.sslcommerz.com/pay")).toBe(false);
    expect(validateGatewayPageUrl("")).toBe(false);
    expect(validateGatewayPageUrl("   ")).toBe(false);
    expect(validateGatewayPageUrl(null)).toBe(false);
    expect(validateGatewayPageUrl(undefined)).toBe(false);
    expect(validateGatewayPageUrl(123)).toBe(false);
  });

  it("is case-insensitive for hostname but still requires exact host equality", () => {
    expect(validateGatewayPageUrl("https://EPAY-GW.SSLCOMMERZ.COM/pay")).toBe(true);
    expect(validateGatewayPageUrl("https://EPAY-GW-EVIL.SSLCOMMERZ.COM/pay")).toBe(false);
  });
});

describe("extractGatewayHostname", () => {
  it("returns the normalized lowercase hostname for parseable URLs", () => {
    expect(extractGatewayHostname("https://EPAY-GW.SSLCOMMERZ.COM/pay?token=abc")).toBe(
      "epay-gw.sslcommerz.com",
    );
    expect(extractGatewayHostname("https://epay-gw.sslcommerz.com")).toBe("epay-gw.sslcommerz.com");
  });

  it("returns null for non-URL or missing values", () => {
    expect(extractGatewayHostname("")).toBe(null);
    expect(extractGatewayHostname("not a url")).toBe(null);
    expect(extractGatewayHostname(null)).toBe(null);
    expect(extractGatewayHostname(undefined)).toBe(null);
  });
});

describe("isStaleCheckout", () => {
  const now = Date.parse("2026-08-29T06:00:00.000Z");
  const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();

  it("treats a pending checkout under 15 minutes old as active", () => {
    expect(isStaleCheckout(minutesAgo(0), now)).toBe(false);
    expect(isStaleCheckout(minutesAgo(14), now)).toBe(false);
    expect(isStaleCheckout(minutesAgo(14.9), now)).toBe(false);
  });

  it("treats a pending checkout at or past 15 minutes as stale", () => {
    expect(isStaleCheckout(minutesAgo(15), now)).toBe(true);
    expect(isStaleCheckout(minutesAgo(60), now)).toBe(true);
  });

  it("never reports stale for unusable timestamps", () => {
    expect(isStaleCheckout(null, now)).toBe(false);
    expect(isStaleCheckout(undefined, now)).toBe(false);
    expect(isStaleCheckout("not-a-date", now)).toBe(false);
    expect(isStaleCheckout(12345, now)).toBe(false);
  });

  it("uses a 15 minute window and a bounded expiry reason", () => {
    expect(CHECKOUT_ACTIVE_WINDOW_MS).toBe(15 * 60 * 1000);
    expect(CHECKOUT_EXPIRED_REASON).toBe("checkout_expired");
  });
});
