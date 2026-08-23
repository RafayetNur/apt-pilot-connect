import { createFileRoute } from "@tanstack/react-router";

import { ManagerShell } from "@/components/manager-shell";
import { ReportsPage } from "@/components/reports/reports-page";

export const Route = createFileRoute("/_authenticated/manager/reports")({
  head: () => ({
    meta: [
      { title: "Assigned-building reports — AptPilot manager" },
      {
        name: "description",
        content:
          "Read-only cash-basis financial reports for the buildings assigned to you: monthly statement, cash flow, outstanding rent, collection and expenses.",
      },
      { property: "og:title", content: "Assigned-building reports — AptPilot manager" },
      {
        property: "og:description",
        content:
          "Manager reporting in AptPilot, limited to assigned buildings with export and print support.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ManagerShell>
      <ReportsPage role="manager" />
    </ManagerShell>
  ),
});
