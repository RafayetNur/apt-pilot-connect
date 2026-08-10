import { createFileRoute } from "@tanstack/react-router";

import { TenantCommunicationPage } from "@/components/communication/tenant-communication-page";

export const Route = createFileRoute("/_authenticated/tenant/notices")({
  head: () => ({
    meta: [
      { title: "Notices & Documents | AptPilot" },
      {
        name: "description",
        content:
          "Read notices from your building owner or manager, acknowledge important ones and open documents shared with you.",
      },
      { property: "og:title", content: "Notices & Documents | AptPilot" },
      {
        property: "og:description",
        content: "Your building notices and shared documents in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TenantCommunicationPage,
});
