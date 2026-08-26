import { createFileRoute } from "@tanstack/react-router";

// Same handler as /api/aptbot. This mirror lives under /api/public/* so the
// Expo Android app can reach it on the published domain without the site-level
// auth wall; the handler itself still requires a valid Supabase bearer token.
export const Route = createFileRoute("/api/public/aptbot")({
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
