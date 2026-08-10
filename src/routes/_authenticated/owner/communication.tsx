import { createFileRoute } from "@tanstack/react-router";

import { CommunicationManagementPage } from "@/components/communication/communication-management-page";

export const Route = createFileRoute("/_authenticated/owner/communication")({
  head: () => ({
    meta: [
      { title: "Notices & Documents | AptPilot Owner" },
      {
        name: "description",
        content:
          "Publish building notices, share private documents and track tenant acknowledgements across your AptPilot buildings.",
      },
      { property: "og:title", content: "Notices & Documents | AptPilot Owner" },
      {
        property: "og:description",
        content: "Building notices, shared documents and acknowledgement tracking for owners.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <CommunicationManagementPage role="owner" />,
});
