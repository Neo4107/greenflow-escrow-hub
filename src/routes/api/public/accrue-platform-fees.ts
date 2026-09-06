import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled job: adds the R240 monthly platform fee to each seller's
 * outstanding balance and flags 90-day outstanding-balance notices.
 * Protected by the shared cron secret.
 */
export const Route = createFileRoute("/api/public/accrue-platform-fees")({
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

        const { accrueMonthlyPlatformFees } = await import("@/lib/fees.server");
        try {
          const result = await accrueMonthlyPlatformFees();
          return Response.json({ ok: true, ...result });
        } catch (error) {
          console.error("platform fee accrual failed", error);
          return new Response("Fee accrual failed", { status: 500 });
        }
      },
    },
  },
});
