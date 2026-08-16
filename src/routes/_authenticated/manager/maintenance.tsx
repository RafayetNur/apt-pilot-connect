import { createFileRoute } from "@tanstack/react-router";

import { MaintenanceManagementPage } from "@/components/maintenance/maintenance-management-page";
import { ManagerShell } from "@/components/manager-shell";

export const Route = createFileRoute("/_authenticated/manager/maintenance")({
  head: () => ({
    meta: [
      { title: "Maintenance & Work Orders | AptPilot Manager" },
      {
        name: "description",
        content:
          "Handle maintenance requests for your assigned buildings: acknowledge, schedule visits, run work orders and record repair costs.",
      },
      { property: "og:title", content: "Maintenance & Work Orders | AptPilot Manager" },
      {
        property: "og:description",
        content: "Acknowledge, schedule and resolve maintenance for your assigned buildings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ManagerShell>
      <MaintenanceManagementPage role="manager" />
    </ManagerShell>
  ),
});
