import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/payments/sslcommerz/initiate")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const { resolveCorsHeaders } = await import("@/lib/sslcommerz.server");
        return new Response(null, { status: 204, headers: resolveCorsHeaders(request) });
      },
      POST: async ({ request }) => {
        const { handleInitiate } = await import("@/lib/sslcommerz.server");
        return handleInitiate(request);
      },
    },
  },
});
