import { createFileRoute } from "@tanstack/react-router";

import { DashboardShell } from "@/components/dashboard-shell";

export const Route = createFileRoute("/_authenticated/manager/dashboard")({
  head: () => ({
    meta: [
      { title: "Manager dashboard — AptPilot" },
      {
        name: "description",
        content: "Manager workspace for day-to-day apartment building operations on AptPilot.",
      },
      { property: "og:title", content: "Manager dashboard — AptPilot" },
      { property: "og:description", content: "Your AptPilot manager workspace." },
    ],
  }),
  component: () => (
    <DashboardShell
      role="manager"
      title="Manager dashboard"
      intro="This is your manager workspace. Daily operations tools will appear here as modules are added."
    />
  ),
});
