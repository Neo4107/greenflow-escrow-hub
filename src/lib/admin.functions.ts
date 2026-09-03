import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: {
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
  userId: string;
}) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (data !== true) throw new Error("Forbidden");
}

export const getAdminQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { supabase } = context;

    const [{ data: certificates }, { data: pendingProducts }, { data: sellers }] =
      await Promise.all([
        supabase
          .from("brand_certificates")
          .select("*")
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
        supabase
          .from("products")
          .select("id, title, slug, brand_name, price_cents, seller_id, status, created_at")
          .eq("status", "pending_admin_review")
          .order("created_at", { ascending: false }),
        supabase
          .from("sellers")
          .select(
            "id, store_name, slug, province, is_active_subscription, subscription_status, next_billing_date",
          )
          .order("created_at", { ascending: false }),
      ]);

    return {
      certificates: certificates ?? [],
      pendingProducts: pendingProducts ?? [],
      sellers: sellers ?? [],
    };
  });

export const getCertificateDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ path: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { data: signed, error } = await context.supabase.storage
      .from("brand-certificates")
      .createSignedUrl(data.path, 300);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

export const reviewCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        certificateId: z.string().uuid(),
        approve: z.boolean(),
        notes: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabase, userId } = context;

    const { data: certificate, error } = await supabase
      .from("brand_certificates")
      .update({
        status: data.approve ? "approved" : "rejected",
        review_notes: data.notes ?? null,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.certificateId)
      .select("product_id")
      .single();
    if (error) throw new Error(error.message);

    const { error: productError } = await supabase
      .from("products")
      .update({
        status: data.approve ? "approved" : "rejected",
        admin_notes: data.notes ?? null,
      })
      .eq("id", certificate.product_id);
    if (productError) throw new Error(productError.message);

    return { ok: true };
  });

export const setSellerSubscriptionActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ sellerId: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const nextBilling = new Date();
    nextBilling.setMonth(nextBilling.getMonth() + 1);

    const { error } = await context.supabase
      .from("sellers")
      .update({
        is_active_subscription: data.active,
        subscription_status: data.active ? "active" : "past_due",
        next_billing_date: data.active ? nextBilling.toISOString().slice(0, 10) : null,
      })
      .eq("id", data.sellerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { supabase } = context;

    const [
      { data: sellers },
      { data: certificates },
      { data: products },
      { data: payouts },
      { data: tickets },
      { data: orders },
    ] = await Promise.all([
      supabase
        .from("sellers")
        .select(
          "id, store_name, slug, province, contact_email, is_active_subscription, subscription_status, subscription_fee_cents, next_billing_date, commission_rate, created_at",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("brand_certificates")
        .select(
          "id, product_id, seller_id, brand_name, document_path, document_type, certification_expiry_date, status, created_at",
        )
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("products")
        .select("id, title, slug, seller_id, status, price_cents, stock, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("seller_payouts")
        .select(
          "id, seller_id, order_id, gross_cents, commission_cents, amount_cents, status, escrow_release_at, released_at, paid_at",
        )
        .order("escrow_release_at", { ascending: true })
        .limit(1000),
      supabase
        .from("return_requests")
        .select(
          "id, order_id, order_item_id, seller_id, reason, requested_outcome, item_damaged, item_used, status, refund_amount_cents, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("orders")
        .select("id, buyer_email, subtotal_cents, commission_cents, payout_cents, status, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    return {
      sellers: sellers ?? [],
      certificates: certificates ?? [],
      products: products ?? [],
      payouts: payouts ?? [],
      tickets: tickets ?? [],
      orders: orders ?? [],
    };
  });
