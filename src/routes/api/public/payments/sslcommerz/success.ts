import { createFileRoute } from "@tanstack/react-router";

// Landing page only. Redirect data is never treated as payment confirmation;
// only the IPN route (after server-to-server validation) can credit rent.
export const Route = createFileRoute("/api/public/payments/sslcommerz/success")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleRedirectLanding } = await import("@/lib/sslcommerz.server");
        return handleRedirectLanding(request, "success");
      },
      POST: async ({ request }) => {
        const { handleRedirectLanding } = await import("@/lib/sslcommerz.server");
        return handleRedirectLanding(request, "success");
      },
    },
  },
});
