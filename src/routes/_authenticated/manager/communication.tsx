import { createFileRoute } from "@tanstack/react-router";

import { CommunicationManagementPage } from "@/components/communication/communication-management-page";

export const Route = createFileRoute("/_authenticated/manager/communication")({
  head: () => ({
    meta: [
      { title: "Notices & Documents | AptPilot Manager" },
      {
        name: "description",
        content:
          "Publish building notices and share authorised documents with tenants of the buildings you manage.",
      },
      { property: "og:title", content: "Notices & Documents | AptPilot Manager" },
      {
        property: "og:description",
        content: "Manager tools for building notices, documents and acknowledgements.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <CommunicationManagementPage role="manager" />,
});
