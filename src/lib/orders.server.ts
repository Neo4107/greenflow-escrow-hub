/**
 * Server-only money movement for buyer orders.
 *
 * Model: the buyer pays the full amount into the marketplace Paystack account.
 * The 10% commission is retained by the marketplace immediately; the remaining
 * 90% is booked into `seller_payouts` with a 14-day escrow release date and is
 * only paid out to the seller once that escrow window closes with no dispute.
 */
import { ESCROW_DAYS } from "./eco";

export async function recordOrderPaid(params: { reference: string; amountCents?: number }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, status, subtotal_cents, commission_cents, payout_cents")
    .eq("gateway_reference", params.reference)
    .maybeSingle();
  if (error) throw error;
  if (!order) return { ok: false as const, reason: "unknown_reference" as const };
  if (order.status === "paid") return { ok: true as const, alreadyPaid: true as const };

  const paidAt = new Date();

  const { error: orderErr } = await supabaseAdmin
    .from("orders")
    .update({ status: "paid", paid_at: paidAt.toISOString() })
    .eq("id", order.id);
  if (orderErr) throw orderErr;

  const { data: items, error: itemsErr } = await supabaseAdmin
    .from("order_items")
    .select("seller_id, product_id, quantity, subtotal_cents, commission_cents, payout_cents")
    .eq("order_id", order.id);
  if (itemsErr) throw itemsErr;

  // One escrow payout row per seller in the order.
  const perSeller = new Map<string, { gross: number; commission: number; payout: number }>();
  for (const item of items ?? []) {
    const current = perSeller.get(item.seller_id) ?? { gross: 0, commission: 0, payout: 0 };
    current.gross += item.subtotal_cents;
    current.commission += item.commission_cents;
    current.payout += item.payout_cents;
    perSeller.set(item.seller_id, current);
  }

  const releaseAt = new Date(paidAt.getTime() + ESCROW_DAYS * 24 * 60 * 60 * 1000);

  if (perSeller.size > 0) {
    const { error: payoutErr } = await supabaseAdmin.from("seller_payouts").upsert(
      [...perSeller.entries()].map(([sellerId, totals]) => ({
        order_id: order.id,
        seller_id: sellerId,
        gross_cents: totals.gross,
        commission_cents: totals.commission,
        amount_cents: totals.payout,
        escrow_release_at: releaseAt.toISOString(),
        status: "escrow" as const,
        notes: `${ESCROW_DAYS}-day escrow; marketplace retained ${totals.commission} cents commission.`,
      })),
      { onConflict: "order_id,seller_id" },
    );
    if (payoutErr) throw payoutErr;
  }

  // Reserve stock for the paid items.
  for (const item of items ?? []) {
    const { data: product } = await supabaseAdmin
      .from("products")
      .select("stock")
      .eq("id", item.product_id)
      .maybeSingle();
    if (!product) continue;
    await supabaseAdmin
      .from("products")
      .update({ stock: Math.max(0, product.stock - item.quantity) })
      .eq("id", item.product_id);
  }

  return {
    ok: true as const,
    alreadyPaid: false as const,
    commissionCents: order.commission_cents,
    escrowCents: order.payout_cents,
    escrowReleaseAt: releaseAt.toISOString(),
  };
}

export async function markOrderFailed(params: { reference: string; refunded?: boolean }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("gateway_reference", params.reference)
    .maybeSingle();
  if (!order) return { ok: false as const };

  await supabaseAdmin
    .from("orders")
    .update({ status: params.refunded ? "refunded" : "failed" })
    .eq("id", order.id);

  // Money never leaves escrow for a failed or refunded order.
  await supabaseAdmin
    .from("seller_payouts")
    .update({ status: params.refunded ? "refunded" : "withheld" })
    .eq("order_id", order.id)
    .in("status", ["escrow", "releasable"]);

  return { ok: true as const };
}

/** Flips every escrow payout whose 14-day window has closed to `releasable`. */
export async function releaseDuePayouts() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("seller_payouts")
    .update({ status: "releasable", released_at: now })
    .eq("status", "escrow")
    .lte("escrow_release_at", now)
    .select("id, seller_id, amount_cents");
  if (error) throw error;

  return {
    releasedCount: (data ?? []).length,
    releasedCents: (data ?? []).reduce((sum, row) => sum + row.amount_cents, 0),
  };
}
