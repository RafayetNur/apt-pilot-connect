import { createFileRoute } from "@tanstack/react-router";

import { DashboardShell } from "@/components/dashboard-shell";

export const Route = createFileRoute("/_authenticated/owner/dashboard")({
  head: () => ({
    meta: [
      { title: "Owner dashboard — AptPilot" },
      {
        name: "description",
        content: "Owner workspace for managing your apartment buildings on AptPilot.",
      },
      { property: "og:title", content: "Owner dashboard — AptPilot" },
      { property: "og:description", content: "Your AptPilot owner workspace." },
    ],
  }),
  component: () => (
    <DashboardShell
      role="owner"
      title="Owner dashboard"
      intro="This is your owner workspace. Building, flat and financial modules will be added here step by step."
    />
  ),
});
