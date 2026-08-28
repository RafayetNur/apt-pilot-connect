import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/payments/sslcommerz/cancel")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleRedirectLanding } = await import("@/lib/sslcommerz.server");
        return handleRedirectLanding(request, "cancel");
      },
      POST: async ({ request }) => {
        const { handleRedirectLanding } = await import("@/lib/sslcommerz.server");
        return handleRedirectLanding(request, "cancel");
      },
    },
  },
});
