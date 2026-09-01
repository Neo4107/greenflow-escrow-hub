import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled job: releases every seller payout whose 14-day escrow window has
 * closed. Protected by a shared cron secret.
 */
export const Route = createFileRoute("/api/public/release-escrow")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["LOVABLE_CRON_SECRET"];
        const provided =
          request.headers.get("x-cron-secret") ??
          (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        if (!secret || provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { releaseDuePayouts } = await import("@/lib/orders.server");
        try {
          const result = await releaseDuePayouts();
          return Response.json({ ok: true, ...result });
        } catch (error) {
          console.error("escrow release failed", error);
          return new Response("Escrow release failed", { status: 500 });
        }
      },
    },
  },
});
