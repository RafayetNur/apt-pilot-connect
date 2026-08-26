import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/aptbot")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const { resolveCorsHeaders } = await import("@/lib/aptbot.server");
        return new Response(null, { status: 204, headers: resolveCorsHeaders(request) });
      },
      POST: async ({ request }) => {
        const { handleAptbotPost } = await import("@/lib/aptbot.server");
        return handleAptbotPost(request);
      },
    },
  },
});
