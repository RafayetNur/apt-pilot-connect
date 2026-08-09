import { createFileRoute } from "@tanstack/react-router";

import { ExpensesPage } from "@/components/expenses/expenses-page";
import { OwnerShell } from "@/components/owner-shell";

export const Route = createFileRoute("/_authenticated/owner/expenses")({
  head: () => ({
    meta: [
      { title: "Building expenses — AptPilot owner" },
      {
        name: "description",
        content:
          "Record and approve actual building operating expenses per accounting month in AptPilot, kept separate from tenant bills.",
      },
      { property: "og:title", content: "Building expenses — AptPilot owner" },
      {
        property: "og:description",
        content: "Owner expense recording, approval and cancellation history for your buildings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <OwnerShell>
      <ExpensesPage role="owner" />
    </OwnerShell>
  ),
});
