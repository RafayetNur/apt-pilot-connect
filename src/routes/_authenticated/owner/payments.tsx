import { createFileRoute } from "@tanstack/react-router";

import { OwnerShell } from "@/components/owner-shell";
import { PaymentsReviewPage } from "@/components/payments/payments-review-page";

export const Route = createFileRoute("/_authenticated/owner/payments")({
  head: () => ({
    meta: [
      { title: "Payments — AptPilot owner" },
      {
        name: "description",
        content:
          "Review tenant rent payment submissions, verify partial payments and issue digital receipts for your AptPilot buildings.",
      },
      { property: "og:title", content: "Payments — AptPilot owner" },
      {
        property: "og:description",
        content: "Verify bKash, Nagad, bank transfer and cash rent payments in AptPilot.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <OwnerShell>
      <PaymentsReviewPage role="owner" />
    </OwnerShell>
  ),
});
