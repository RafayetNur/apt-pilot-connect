import { createFileRoute } from "@tanstack/react-router";

import { TenantMaintenancePage } from "@/components/maintenance/tenant-maintenance-page";
import { TenantShell } from "@/components/tenant-shell";

export const Route = createFileRoute("/_authenticated/tenant/maintenance")({
  head: () => ({
    meta: [
      { title: "Report a Maintenance Issue | AptPilot" },
      {
        name: "description",
        content:
          "Report a problem in your flat or the building's common areas and follow the repair progress in AptPilot.",
      },
      { property: "og:title", content: "Report a Maintenance Issue | AptPilot" },
      {
        property: "og:description",
        content: "Submit maintenance requests with photos and track their status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <TenantShell>
      <TenantMaintenancePage />
    </TenantShell>
  ),
});
