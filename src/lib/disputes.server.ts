/**
 * Server-only escrow reversal for dispute resolutions.
 *
 * When an admin resolves a dispute in the buyer's favour, the seller's 90%
 * share must not leave escrow. A full refund reverses the payout row entirely;
 * a partial refund reduces the escrowed amount and leaves the rest on track for
 * the normal 14-day release.
 */
export async function reverseEscrowForDispute(params: {
  orderId: string;
  sellerId: string;
  refundCents: number;
  reason: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: payout, error } = await supabaseAdmin
    .from("seller_payouts")
    .select("id, amount_cents, gross_cents, commission_cents, status, notes")
    .eq("order_id", params.orderId)
    .eq("seller_id", params.sellerId)
    .maybeSingle();
  if (error) throw error;
  if (!payout) return { reversed: false as const, reason: "no_payout" as const };

  if (payout.status === "paid") {
    // Already out the door — flag it for manual clawback instead of rewriting history.
    await supabaseAdmin
      .from("seller_payouts")
      .update({
        notes:
          `${payout.notes ?? ""}\nDispute resolved after payout: recover ${params.refundCents} cents. ${params.reason}`.trim(),
      })
      .eq("id", payout.id);
    return { reversed: false as const, reason: "already_paid" as const };
  }

  const fullReversal = params.refundCents >= payout.amount_cents;
  const remaining = Math.max(0, payout.amount_cents - params.refundCents);

  const { error: updateError } = await supabaseAdmin
    .from("seller_payouts")
    .update({
      status: fullReversal ? "reversed" : payout.status,
      amount_cents: fullReversal ? 0 : remaining,
      released_at: null,
      notes:
        `${payout.notes ?? ""}\nEscrow reversed by dispute resolution (${params.refundCents} cents refunded to buyer). ${params.reason}`.trim(),
    })
    .eq("id", payout.id);
  if (updateError) throw updateError;

  // A full reversal of the whole order means the buyer was made whole.
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, subtotal_cents")
    .eq("id", params.orderId)
    .maybeSingle();
  if (order && params.refundCents >= order.subtotal_cents) {
    await supabaseAdmin.from("orders").update({ status: "refunded" }).eq("id", order.id);
  }

  return {
    reversed: true as const,
    fullReversal,
    remainingEscrowCents: fullReversal ? 0 : remaining,
  };
}
