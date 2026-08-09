import { createFileRoute } from "@tanstack/react-router";

import { MaintenanceManagementPage } from "@/components/maintenance/maintenance-management-page";

export const Route = createFileRoute("/_authenticated/owner/maintenance")({
  head: () => ({
    meta: [
      { title: "Maintenance & Work Orders | AptPilot Owner" },
      {
        name: "description",
        content:
          "Review, assign and resolve building maintenance requests and work orders across all your AptPilot buildings.",
      },
      { property: "og:title", content: "Maintenance & Work Orders | AptPilot Owner" },
      {
        property: "og:description",
        content: "Track reported problems, work orders and repair costs for your buildings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <MaintenanceManagementPage role="owner" />,
});
