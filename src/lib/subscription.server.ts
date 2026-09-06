/**
 * Server-only helpers for out-of-pocket platform fee payments.
 *
 * There is no upfront fee any more: listings stay live regardless of balance.
 * A successful R240 charge simply clears (part of) the seller's outstanding
 * platform fee balance.
 */

export async function activateSubscriptionForReference(params: {
  reference: string;
  amountCents?: number;
}) {
  const { settleFeeBalanceForPayment } = await import("./fees.server");
  const result = await settleFeeBalanceForPayment(params);
  if (!result.ok) return result;
  return { ok: true as const, alreadyPaid: result.alreadyPaid === true };
}

/** Marks a failed/reversed fee charge; the balance simply stays outstanding. */
export async function markSubscriptionPastDue(params: { reference: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: payment } = await supabaseAdmin
    .from("subscription_payments")
    .select("id, seller_id, amount_cents, status")
    .eq("gateway_reference", params.reference)
    .maybeSingle();
  if (!payment) return { ok: false as const, reason: "unknown_reference" };

  const wasPaid = payment.status === "paid";

  await supabaseAdmin
    .from("subscription_payments")
    .update({ status: "failed" })
    .eq("id", payment.id);

  if (wasPaid) {
    // A reversal puts the amount back onto the outstanding balance.
    const { data: seller } = await supabaseAdmin
      .from("sellers")
      .select("outstanding_fee_cents")
      .eq("id", payment.seller_id)
      .maybeSingle();
    const balance = (seller?.outstanding_fee_cents ?? 0) + payment.amount_cents;
    await supabaseAdmin
      .from("sellers")
      .update({ outstanding_fee_cents: balance, subscription_status: "past_due" })
      .eq("id", payment.seller_id);
    await supabaseAdmin.from("platform_fee_ledger").insert({
      seller_id: payment.seller_id,
      entry_type: "fee_charge",
      amount_cents: payment.amount_cents,
      balance_after_cents: balance,
      description: "Fee payment reversed — amount returned to outstanding balance",
      subscription_payment_id: payment.id,
    });
  }

  return { ok: true as const };
}
