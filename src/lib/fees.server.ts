/**
 * Server-only platform fee accounting.
 *
 * Model (no upfront fees): a seller lists for free. The R240 platform fee is
 * charged monthly into an outstanding balance. Whenever a sale is paid, the
 * outstanding balance (plus the 10% commission, which is already retained at
 * order time) is deducted from that seller's escrow payout. Sellers may also
 * settle the balance out of pocket at any time.
 */
import { FEE_NOTICE_DAYS, SUBSCRIPTION_FEE_CENTS } from "./eco";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

async function writeLedger(
  db: Admin,
  entry: {
    sellerId: string;
    entryType: "fee_charge" | "sales_deduction" | "out_of_pocket_payment" | "write_off";
    amountCents: number;
    balanceAfterCents: number;
    description: string;
    orderId?: string | null;
    payoutId?: string | null;
    subscriptionPaymentId?: string | null;
    periodStart?: string | null;
  },
) {
  await db.from("platform_fee_ledger").insert({
    seller_id: entry.sellerId,
    entry_type: entry.entryType,
    amount_cents: entry.amountCents,
    balance_after_cents: entry.balanceAfterCents,
    description: entry.description,
    order_id: entry.orderId ?? null,
    payout_id: entry.payoutId ?? null,
    subscription_payment_id: entry.subscriptionPaymentId ?? null,
    period_start: entry.periodStart ?? null,
  });
}

/**
 * Charges the R240 monthly platform fee for every month a store has been
 * listed but not yet billed, and flags sellers who have carried an unpaid
 * balance for 90 days so the outstanding-balance notice can be shown.
 */
export async function accrueMonthlyPlatformFees(options?: { sellerId?: string }) {
  const db = await admin();
  const now = new Date();

  let query = db
    .from("sellers")
    .select(
      "id, store_name, outstanding_fee_cents, listing_started_at, fees_charged_through, fee_notice_90d_sent_at, subscription_fee_cents",
    );
  if (options?.sellerId) query = query.eq("id", options.sellerId);

  const { data: sellers, error } = await query;
  if (error) throw error;

  let chargedSellers = 0;
  let chargedCents = 0;
  let noticesFlagged = 0;

  for (const seller of sellers ?? []) {
    const feeCents = seller.subscription_fee_cents || SUBSCRIPTION_FEE_CENTS;
    const listingStart = new Date(seller.listing_started_at);
    let balance = seller.outstanding_fee_cents;
    let chargedThrough = seller.fees_charged_through;
    let charges = 0;

    for (let month = 0; month < 240; month += 1) {
      const period = new Date(
        Date.UTC(
          listingStart.getUTCFullYear(),
          listingStart.getUTCMonth() + month,
          listingStart.getUTCDate(),
        ),
      );
      if (period.getTime() > now.getTime()) break;
      const periodStart = isoDate(period);
      if (chargedThrough && periodStart <= chargedThrough) continue;

      balance += feeCents;
      await writeLedger(db, {
        sellerId: seller.id,
        entryType: "fee_charge",
        amountCents: feeCents,
        balanceAfterCents: balance,
        description: `Monthly platform fee for the period starting ${periodStart}`,
        periodStart,
      });
      chargedThrough = periodStart;
      charges += 1;
      chargedCents += feeCents;
    }

    const daysListed = Math.floor((now.getTime() - listingStart.getTime()) / 86_400_000);
    const needsNotice =
      balance > 0 && daysListed >= FEE_NOTICE_DAYS && !seller.fee_notice_90d_sent_at;

    if (charges > 0 || needsNotice) {
      await db
        .from("sellers")
        .update({
          outstanding_fee_cents: balance,
          fees_charged_through: chargedThrough,
          ...(needsNotice ? { fee_notice_90d_sent_at: now.toISOString() } : {}),
        })
        .eq("id", seller.id);
      if (charges > 0) chargedSellers += 1;
      if (needsNotice) noticesFlagged += 1;
    }
  }

  return { chargedSellers, chargedCents, noticesFlagged };
}

/**
 * Deducts as much of the seller's outstanding platform fee balance as the
 * payout can cover. Returns the amount deducted and the payout amount left.
 */
export async function deductFeesFromPayout(params: {
  sellerId: string;
  payoutId: string;
  orderId: string;
  payoutCents: number;
}) {
  const db = await admin();

  const { data: seller } = await db
    .from("sellers")
    .select("outstanding_fee_cents")
    .eq("id", params.sellerId)
    .maybeSingle();

  const outstanding = seller?.outstanding_fee_cents ?? 0;
  if (outstanding <= 0 || params.payoutCents <= 0) {
    return { deductedCents: 0, remainingPayoutCents: params.payoutCents, outstandingCents: outstanding };
  }

  const deducted = Math.min(outstanding, params.payoutCents);
  const balance = outstanding - deducted;
  const remainingPayout = params.payoutCents - deducted;

  await db
    .from("seller_payouts")
    .update({ amount_cents: remainingPayout, fee_deducted_cents: deducted })
    .eq("id", params.payoutId);

  await db.from("sellers").update({ outstanding_fee_cents: balance }).eq("id", params.sellerId);

  await writeLedger(db, {
    sellerId: params.sellerId,
    entryType: "sales_deduction",
    amountCents: deducted,
    balanceAfterCents: balance,
    description: "Platform fee deducted from sales balance",
    orderId: params.orderId,
    payoutId: params.payoutId,
  });

  return { deductedCents: deducted, remainingPayoutCents: remainingPayout, outstandingCents: balance };
}

/** Applies a successful out-of-pocket fee payment against the seller's balance. */
export async function settleFeeBalanceForPayment(params: {
  reference: string;
  amountCents?: number;
}) {
  const db = await admin();

  const { data: payment } = await db
    .from("subscription_payments")
    .select("id, seller_id, status, amount_cents")
    .eq("gateway_reference", params.reference)
    .maybeSingle();
  if (!payment) return { ok: false as const, reason: "unknown_reference" as const };
  if (payment.status === "paid") return { ok: true as const, alreadyPaid: true as const };

  const paidCents = params.amountCents ?? payment.amount_cents;

  await db
    .from("subscription_payments")
    .update({ status: "paid", paid_at: new Date().toISOString(), amount_cents: paidCents })
    .eq("id", payment.id);

  const { data: seller } = await db
    .from("sellers")
    .select("outstanding_fee_cents")
    .eq("id", payment.seller_id)
    .maybeSingle();

  const balance = Math.max(0, (seller?.outstanding_fee_cents ?? 0) - paidCents);

  await db
    .from("sellers")
    .update({
      outstanding_fee_cents: balance,
      subscription_status: "active",
      is_active_subscription: true,
      ...(balance === 0 ? { fee_notice_90d_sent_at: null } : {}),
    })
    .eq("id", payment.seller_id);

  await writeLedger(db, {
    sellerId: payment.seller_id,
    entryType: "out_of_pocket_payment",
    amountCents: paidCents,
    balanceAfterCents: balance,
    description: "Platform fee paid out of pocket",
    subscriptionPaymentId: payment.id,
  });

  return { ok: true as const, alreadyPaid: false as const, outstandingCents: balance };
}
