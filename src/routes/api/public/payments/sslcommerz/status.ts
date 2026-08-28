import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/payments/sslcommerz/status")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const { resolveCorsHeaders } = await import("@/lib/sslcommerz.server");
        return new Response(null, {
          status: 204,
          headers: resolveCorsHeaders(request, "GET, OPTIONS"),
        });
      },
      GET: async ({ request }) => {
        const { handleStatus } = await import("@/lib/sslcommerz.server");
        return handleStatus(request);
      },
    },
  },
});
