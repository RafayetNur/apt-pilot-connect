import { createFileRoute } from "@tanstack/react-router";

import { BillsPage } from "@/components/bills/bills-page";
import { OwnerShell } from "@/components/owner-shell";

export const Route = createFileRoute("/_authenticated/owner/bills")({
  head: () => ({
    meta: [
      { title: "Flat & shared bills — AptPilot owner" },
      {
        name: "description",
        content:
          "Enter final electricity, gas, water and internet bill amounts per flat and split shared building charges equally in AptPilot.",
      },
      { property: "og:title", content: "Flat & shared bills — AptPilot owner" },
      {
        property: "og:description",
        content: "Bulk monthly bill entry and equal shared-charge splitting for your buildings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <OwnerShell>
      <BillsPage role="owner" />
    </OwnerShell>
  ),
});
