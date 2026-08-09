import { createFileRoute } from "@tanstack/react-router";

import { OwnerShell } from "@/components/owner-shell";
import { ReportsPage } from "@/components/reports/reports-page";

export const Route = createFileRoute("/_authenticated/owner/reports")({
  head: () => ({
    meta: [
      { title: "Financial reports — AptPilot owner" },
      {
        name: "description",
        content:
          "Cash-basis monthly building statements, cash flow, outstanding rent, collection, expense and tenant ledger reports for the buildings you own.",
      },
      { property: "og:title", content: "Financial reports — AptPilot owner" },
      {
        property: "og:description",
        content:
          "Owner financial reporting in AptPilot: billed, collected, outstanding, approved expenses and net cash movement.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <OwnerShell>
      <ReportsPage role="owner" />
    </OwnerShell>
  ),
});
