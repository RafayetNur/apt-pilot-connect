import { createFileRoute } from "@tanstack/react-router";

import { ExpensesPage } from "@/components/expenses/expenses-page";
import { ManagerShell } from "@/components/manager-shell";

export const Route = createFileRoute("/_authenticated/manager/expenses")({
  head: () => ({
    meta: [
      { title: "Building expenses — AptPilot manager" },
      {
        name: "description",
        content:
          "Submit building operating expenses with receipts for owner approval in the buildings assigned to you in AptPilot.",
      },
      { property: "og:title", content: "Building expenses — AptPilot manager" },
      {
        property: "og:description",
        content: "Manager expense submission and approval tracking for assigned buildings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ManagerShell>
      <ExpensesPage role="manager" />
    </ManagerShell>
  ),
});
