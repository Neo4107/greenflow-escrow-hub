import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PAYSTACK_SECRET_KEY"];
        if (!secret) {
          // No key stored yet: acknowledge so Paystack doesn't retry, and log it.
          console.warn("paystack webhook received but PAYSTACK_SECRET_KEY is not configured");
          return Response.json({ ok: false, reason: "gateway_unconfigured" });
        }


        const raw = await request.text();
        const signature = request.headers.get("x-paystack-signature") ?? "";
        const expected = createHmac("sha512", secret).update(raw).digest("hex");
        const sig = Buffer.from(signature);
        const exp = Buffer.from(expected);
        if (sig.length !== exp.length || !timingSafeEqual(sig, exp)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let event: {
          event?: string;
          data?: {
            reference?: string;
            amount?: number;
            currency?: string;
            status?: string;
            metadata?: { purpose?: string };
          };
        };
        try {
          event = JSON.parse(raw);
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        const reference = event.data?.reference;
        if (!reference) return new Response("ok");

        const purpose = event.data?.metadata?.purpose;
        if (purpose && purpose !== "seller_subscription") return new Response("ok");

        const { activateSubscriptionForReference, markSubscriptionPastDue } = await import(
          "@/lib/subscription.server"
        );

        try {
          if (event.event === "charge.success" && event.data?.status === "success") {
            await activateSubscriptionForReference({
              reference,
              ...(typeof event.data.amount === "number" ? { amountCents: event.data.amount } : {}),
            });
          } else if (
            event.event === "charge.failed" ||
            event.event === "refund.processed" ||
            event.event === "charge.dispute.create"
          ) {
            await markSubscriptionPastDue({ reference });
          }
        } catch (error) {
          console.error("paystack webhook handling failed", error);
          return new Response("Webhook processing failed", { status: 500 });
        }

        return new Response("ok");
      },
    },
  },
});
