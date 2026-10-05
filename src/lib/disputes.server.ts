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

/** Asks Paystack to return the refund to the shopper and records the attempt on the ticket. */
export async function sendDisputeRefund(params: {
  ticketId: string;
  orderId: string;
  refundCents: number;
  note: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { paystackKey, createRefund } = await import("./paystack.server");

  if (!paystackKey()) {
    await supabaseAdmin
      .from("return_requests")
      .update({ refund_gateway_status: "not_sent" })
      .eq("id", params.ticketId);
    return { sent: false as const, reason: "gateway_unconfigured" as const };
  }

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("gateway_reference, status")
    .eq("id", params.orderId)
    .maybeSingle();
  if (!order) return { sent: false as const, reason: "no_order" as const };

  try {
    const refund = await createRefund({
      transactionReference: order.gateway_reference,
      amountCents: params.refundCents,
      note: `Dispute ${params.ticketId}: ${params.note}`,
    });
    await supabaseAdmin
      .from("return_requests")
      .update({ refund_gateway_status: "pending", refund_gateway_reference: refund.refundId })
      .eq("id", params.ticketId);
    return { sent: true as const, refundId: refund.refundId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refund request failed";
    await supabaseAdmin
      .from("return_requests")
      .update({ refund_gateway_status: "failed", admin_notes: `Paystack refund failed: ${message}` })
      .eq("id", params.ticketId);
    return { sent: false as const, reason: "gateway_error" as const, message };
  }
}

/**
 * Handles Paystack refund.* webhooks. Dispute refunds were already taken out of
 * the seller's escrow at resolution time, so here we only confirm delivery.
 * Refunds started directly in Paystack (no ticket) reverse escrow here instead.
 */
export async function handleRefundWebhook(params: {
  event: string;
  transactionReference: string;
  amountCents: number;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, subtotal_cents")
    .eq("gateway_reference", params.transactionReference)
    .maybeSingle();
  if (!order) return { ok: false as const, reason: "unknown_order" as const };

  const { data: tickets } = await supabaseAdmin
    .from("return_requests")
    .select("id, seller_id, refund_amount_cents, refund_gateway_status")
    .eq("order_id", order.id)
    .in("refund_gateway_status", ["pending", "failed", "not_sent"])
    .order("resolved_at", { ascending: true });

  const ticket =
    (tickets ?? []).find((t) => t.refund_amount_cents === params.amountCents) ?? tickets?.[0];

  const processed = params.event === "refund.processed";
  const failed = params.event === "refund.failed";

  if (ticket) {
    if (processed) {
      await supabaseAdmin
        .from("return_requests")
        .update({ refund_gateway_status: "processed", refund_processed_at: new Date().toISOString() })
        .eq("id", ticket.id);
    } else if (failed) {
      await supabaseAdmin
        .from("return_requests")
        .update({ refund_gateway_status: "failed" })
        .eq("id", ticket.id);
    }
    return { ok: true as const, ticketId: ticket.id };
  }

  if (!processed) return { ok: true as const };

  // Refund made outside the dispute console: take it out of escrow per seller.
  const { data: payouts } = await supabaseAdmin
    .from("seller_payouts")
    .select("seller_id, gross_cents")
    .eq("order_id", order.id);
  for (const p of payouts ?? []) {
    const share =
      params.amountCents >= order.subtotal_cents || order.subtotal_cents === 0
        ? Number.MAX_SAFE_INTEGER
        : Math.round((params.amountCents * p.gross_cents) / order.subtotal_cents * 0.9);
    await reverseEscrowForDispute({
      orderId: order.id,
      sellerId: p.seller_id,
      refundCents: share,
      reason: "Refund issued directly in Paystack.",
    });
  }
  if (params.amountCents >= order.subtotal_cents) {
    await supabaseAdmin.from("orders").update({ status: "refunded" }).eq("id", order.id);
  }
  return { ok: true as const };
}
