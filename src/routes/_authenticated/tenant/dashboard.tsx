import { createFileRoute } from "@tanstack/react-router";

import { DashboardShell } from "@/components/dashboard-shell";

export const Route = createFileRoute("/_authenticated/tenant/dashboard")({
  head: () => ({
    meta: [
      { title: "Tenant dashboard — AptPilot" },
      {
        name: "description",
        content: "Tenant workspace for your flat details, notices and requests on AptPilot.",
      },
      { property: "og:title", content: "Tenant dashboard — AptPilot" },
      { property: "og:description", content: "Your AptPilot tenant workspace." },
    ],
  }),
  component: () => (
    <DashboardShell
      role="tenant"
      title="Tenant dashboard"
      intro="This is your tenant workspace. Your flat details, notices and requests will live here."
    />
  ),
});
