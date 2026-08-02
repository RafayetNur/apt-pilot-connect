import { createFileRoute } from "@tanstack/react-router";

import { ManagerShell } from "@/components/manager-shell";
import { PaymentsReviewPage } from "@/components/payments/payments-review-page";

export const Route = createFileRoute("/_authenticated/manager/payments")({
  head: () => ({
    meta: [
      { title: "Payments — AptPilot manager" },
      {
        name: "description",
        content:
          "Review and verify tenant rent payment submissions for the buildings assigned to you in AptPilot.",
      },
      { property: "og:title", content: "Payments — AptPilot manager" },
      {
        property: "og:description",
        content: "Manager review queue for rent payment submissions and cash collections.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ManagerShell>
      <PaymentsReviewPage role="manager" />
    </ManagerShell>
  ),
});
