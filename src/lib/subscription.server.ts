/**
 * Server-only helper that turns a successful R240 platform-fee charge into an
 * active seller subscription (which is what unlocks the public store + products).
 */
export async function activateSubscriptionForReference(params: {
  reference: string;
  amountCents?: number;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: payment, error } = await supabaseAdmin
    .from("subscription_payments")
    .select("id, seller_id, status, amount_cents, period_end")
    .eq("gateway_reference", params.reference)
    .maybeSingle();

  if (error) throw error;
  if (!payment) return { ok: false as const, reason: "unknown_reference" };
  if (payment.status === "paid") return { ok: true as const, alreadyPaid: true };

  const paidAt = new Date();

  const { error: payErr } = await supabaseAdmin
    .from("subscription_payments")
    .update({
      status: "paid",
      paid_at: paidAt.toISOString(),
      ...(params.amountCents ? { amount_cents: params.amountCents } : {}),
    })
    .eq("id", payment.id);
  if (payErr) throw payErr;

  const nextBilling =
    payment.period_end ??
    new Date(paidAt.getFullYear(), paidAt.getMonth() + 1, paidAt.getDate())
      .toISOString()
      .slice(0, 10);

  const { error: sellerErr } = await supabaseAdmin
    .from("sellers")
    .update({
      is_active_subscription: true,
      subscription_status: "active",
      next_billing_date: nextBilling,
    })
    .eq("id", payment.seller_id);
  if (sellerErr) throw sellerErr;

  return { ok: true as const, sellerId: payment.seller_id };
}

/** Marks a failed/reversed charge and suspends the store until it is paid again. */
export async function markSubscriptionPastDue(params: { reference: string }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: payment } = await supabaseAdmin
    .from("subscription_payments")
    .select("id, seller_id")
    .eq("gateway_reference", params.reference)
    .maybeSingle();
  if (!payment) return { ok: false as const, reason: "unknown_reference" };

  await supabaseAdmin
    .from("subscription_payments")
    .update({ status: "failed" })
    .eq("id", payment.id);

  await supabaseAdmin
    .from("sellers")
    .update({ is_active_subscription: false, subscription_status: "past_due" })
    .eq("id", payment.seller_id);

  return { ok: true as const };
}
