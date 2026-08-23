import { createFileRoute } from "@tanstack/react-router";

import { BillsPage } from "@/components/bills/bills-page";
import { ManagerShell } from "@/components/manager-shell";

export const Route = createFileRoute("/_authenticated/manager/bills")({
  head: () => ({
    meta: [
      { title: "Flat & shared bills — AptPilot manager" },
      {
        name: "description",
        content:
          "Enter final utility bill amounts per flat and split shared building charges for the buildings assigned to you in AptPilot.",
      },
      { property: "og:title", content: "Flat & shared bills — AptPilot manager" },
      {
        property: "og:description",
        content: "Manager bulk bill entry and equal shared-charge splitting.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <ManagerShell>
      <BillsPage role="manager" />
    </ManagerShell>
  ),
});
