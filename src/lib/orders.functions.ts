import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const checkoutSchema = z.object({
  productSlug: z.string().min(1).max(120),
  quantity: z.number().int().min(1).max(20),
  returnUrl: z.string().url(),
});

/**
 * Buyer checkout. Prices are taken from the database (never the client), the
 * 10% marketplace commission is split off up front, and the seller's 90% is
 * recorded as escrow once payment succeeds.
 */
export const startOrderCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => checkoutSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const { commissionBreakdown, COMMISSION_RATE } = await import("./eco");
    const { paystackKey, initializeOrderCharge } = await import("./paystack.server");
    const { createPublicSupabase } = await import("./public-supabase.server");

    // Public client: only approved products of subscribed sellers are buyable.
    const publicDb = createPublicSupabase();
    const { data: product } = await publicDb
      .from("products")
      .select("id, title, price_cents, stock, seller_id")
      .eq("slug", data.productSlug)
      .maybeSingle();
    if (!product) throw new Error("This product is not available for purchase.");
    if (product.stock < data.quantity) throw new Error("Not enough stock available.");

    const subtotal = product.price_cents * data.quantity;
    const { commissionCents, payoutCents } = commissionBreakdown(subtotal);

    const email = (claims as { email?: string }).email ?? "";
    const reference = `ord_${product.id.slice(0, 8)}_${Date.now()}`;

    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        buyer_user_id: userId,
        buyer_email: email,
        subtotal_cents: subtotal,
        commission_cents: commissionCents,
        payout_cents: payoutCents,
        commission_rate: COMMISSION_RATE * 100,
        status: "pending",
        gateway_reference: reference,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { insertOrderItems } = await import("./orders-items.server");
    await insertOrderItems({
      orderId: order.id,
      items: [
        {
          productId: product.id,
          sellerId: product.seller_id,
          title: product.title,
          unitPriceCents: product.price_cents,
          quantity: data.quantity,
          subtotalCents: subtotal,
          commissionCents,
          payoutCents,
        },
      ],
    });

    if (!paystackKey()) {
      return {
        gatewayConfigured: false as const,
        authorizationUrl: null as string | null,
        reference,
        subtotalCents: subtotal,
        commissionCents,
        payoutCents,
      };
    }

    const { authorizationUrl } = await initializeOrderCharge({
      email,
      amountCents: subtotal,
      reference,
      callbackUrl: (await import("./safe-redirect.server")).assertSameOriginReturnUrl(
        data.returnUrl,
      ),
      orderId: order.id,
    });

    return {
      gatewayConfigured: true as const,
      authorizationUrl,
      reference,
      subtotalCents: subtotal,
      commissionCents,
      payoutCents,
    };
  });

/** Called when Paystack redirects the buyer back, so escrow starts immediately. */
export const confirmOrderPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ reference: z.string().min(4).max(120) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: order } = await supabase
      .from("orders")
      .select("id")
      .eq("gateway_reference", data.reference)
      .eq("buyer_user_id", userId)
      .maybeSingle();
    if (!order) return { paid: false as const, reason: "unknown_reference" as const };

    const { paystackKey, verifyTransaction } = await import("./paystack.server");
    if (!paystackKey()) return { paid: false as const, reason: "gateway_unconfigured" as const };

    const verified = await verifyTransaction(data.reference);
    if (verified.status !== "success") {
      return { paid: false as const, reason: "not_successful" as const };
    }

    const { recordOrderPaid } = await import("./orders.server");
    const result = await recordOrderPaid({
      reference: data.reference,
      amountCents: verified.amount,
    });

    return {
      paid: true as const,
      escrowReleaseAt: "escrowReleaseAt" in result ? result.escrowReleaseAt : null,
    };
  });

export const listMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: orders } = await supabase
      .from("orders")
      .select(
        "id, gateway_reference, status, subtotal_cents, commission_cents, payout_cents, paid_at, created_at",
      )
      .eq("buyer_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);

    const orderIds = (orders ?? []).map((o) => o.id);
    const { data: items } = orderIds.length
      ? await supabase
          .from("order_items")
          .select("id, order_id, title, quantity, subtotal_cents, fulfilment_status, courier_name, courier_waybill, packed_at, dispatched_at, delivered_at")
          .in("order_id", orderIds)
      : { data: [] };

    return { orders: orders ?? [], items: items ?? [] };
  });

/** Seller-facing escrow ledger: what is held, what is releasable, what is paid. */
export const listMyPayouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: store } = await supabase
      .from("sellers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    const emptyTotals = {
      escrow: 0,
      releasable: 0,
      paid: 0,
      commission: 0,
      fees: 0,
      gross: 0,
      reversed: 0,
    };
    if (!store) return { payouts: [], sales: [], totals: emptyTotals };

    const [{ data: payouts }, { data: sales }] = await Promise.all([
      supabase
        .from("seller_payouts")
        .select(
          "id, order_id, gross_cents, commission_cents, fee_deducted_cents, amount_cents, escrow_release_at, status, released_at, paid_at, created_at",
        )
        .eq("seller_id", store.id)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("order_items")
        .select("id, order_id, title, quantity, subtotal_cents, created_at, fulfilment_status, courier_waybill, orders(status)")
        .eq("seller_id", store.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const totals = { ...emptyTotals };
    for (const row of payouts ?? []) {
      totals.gross += row.gross_cents;
      totals.commission += row.commission_cents;
      totals.fees += row.fee_deducted_cents;
      if (row.status === "escrow") totals.escrow += row.amount_cents;
      if (row.status === "releasable") totals.releasable += row.amount_cents;
      if (row.status === "paid") totals.paid += row.amount_cents;
      if (row.status === "reversed" || row.status === "refunded") totals.reversed += row.amount_cents;
    }

    return { payouts: payouts ?? [], sales: sales ?? [], totals };
  });

const fulfilmentSchema = z.object({
  orderItemId: z.string().uuid(),
  status: z.enum(["packed", "dispatched", "delivered"]),
  waybill: z.string().trim().max(60).optional(),
});

/** Seller moves an item through packed → dispatched (The Courier Guy waybill) → delivered. */
export const updateFulfilment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => fulfilmentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: store } = await supabase
      .from("sellers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!store) throw new Error("No store found.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: item } = await supabaseAdmin
      .from("order_items")
      .select("id, seller_id, fulfilment_status, orders(status)")
      .eq("id", data.orderItemId)
      .maybeSingle();
    if (!item || item.seller_id !== store.id) throw new Error("Order item not found.");
    const orderStatus = (item.orders as { status: string } | null)?.status;
    if (orderStatus !== "paid") throw new Error("Only paid orders can be fulfilled.");

    const order = ["awaiting_packing", "packed", "dispatched", "delivered"];
    if (order.indexOf(data.status) !== order.indexOf(item.fulfilment_status) + 1) {
      throw new Error("Orders must go packed, then dispatched, then delivered.");
    }
    const now = new Date().toISOString();
    const patch: {
      fulfilment_status: typeof data.status;
      packed_at?: string;
      dispatched_at?: string;
      delivered_at?: string;
      courier_waybill?: string;
    } = { fulfilment_status: data.status };
    if (data.status === "packed") patch.packed_at = now;
    if (data.status === "dispatched") {
      if (!data.waybill) throw new Error("Enter The Courier Guy waybill number.");
      patch.dispatched_at = now;
      patch.courier_waybill = data.waybill;
    }
    if (data.status === "delivered") patch.delivered_at = now;

    const { error } = await supabaseAdmin.from("order_items").update(patch).eq("id", item.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
