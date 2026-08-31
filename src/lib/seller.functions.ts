import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const storeSchema = z.object({
  storeName: z.string().min(2).max(80),
  tagline: z.string().max(140).optional(),
  description: z.string().max(2000).optional(),
  province: z.string().max(40).optional(),
  contactEmail: z.string().email().optional(),
  logoUrl: z.string().url().optional(),
});

const productSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(4000).optional(),
  category: z.string().max(60).optional(),
  priceRands: z.number().positive().max(1000000),
  stock: z.number().int().min(0).max(100000),
  imageUrl: z.string().url().optional(),
  ecoAttributes: z.array(z.string()).min(1),
  isBranded: z.boolean(),
  brandName: z.string().max(80).optional(),
  certificateDocumentPath: z.string().max(400).optional(),
  certificateExpiryDate: z.string().max(20).optional(),
});

export const getMyAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: store }, { data: roles }] = await Promise.all([
      supabase.from("sellers").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    if (!store) {
      return {
        store: null,
        products: [],
        payments: [],
        certificates: [],
        isAdmin: (roles ?? []).some((r) => r.role === "admin"),
      };
    }

    const [{ data: products }, { data: payments }, { data: certificates }] = await Promise.all([
      supabase
        .from("products")
        .select("*")
        .eq("seller_id", store.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("subscription_payments")
        .select("*")
        .eq("seller_id", store.id)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("brand_certificates")
        .select("*")
        .eq("seller_id", store.id)
        .order("created_at", { ascending: false }),
    ]);

    return {
      store,
      products: products ?? [],
      payments: payments ?? [],
      certificates: certificates ?? [],
      isAdmin: (roles ?? []).some((r) => r.role === "admin"),
    };
  });

export const createStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => storeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { slugify } = await import("./eco");

    const base = slugify(data.storeName) || "store";
    let slug = base;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data: clash } = await supabase
        .from("sellers")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!clash) break;
      slug = `${base}-${Math.floor(Math.random() * 9000 + 1000)}`;
    }

    const { data: inserted, error } = await supabase
      .from("sellers")
      .insert({
        user_id: userId,
        store_name: data.storeName,
        slug,
        tagline: data.tagline ?? null,
        description: data.description ?? null,
        province: data.province ?? null,
        contact_email: data.contactEmail ?? null,
        logo_url: data.logoUrl ?? null,
        subscription_status: "trialing",
        is_active_subscription: false,
      })
      .select("id, slug")
      .single();

    if (error) throw new Error(error.message);

    await supabase.from("user_roles").insert({ user_id: userId, role: "seller" });

    return { sellerId: inserted.id, slug: inserted.slug };
  });

export const saveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => productSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { slugify } = await import("./eco");

    const { data: store } = await supabase
      .from("sellers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!store) throw new Error("Create your store before adding products.");

    if (data.isBranded && (!data.brandName || !data.certificateDocumentPath)) {
      throw new Error(
        "Branded listings require a brand name and a Certificate of Authorization / Letter of Authority.",
      );
    }

    const base = slugify(data.title) || "product";
    let slug = base;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data: clash } = await supabase
        .from("products")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!clash) break;
      slug = `${base}-${Math.floor(Math.random() * 9000 + 1000)}`;
    }

    const { data: product, error } = await supabase
      .from("products")
      .insert({
        seller_id: store.id,
        title: data.title,
        slug,
        description: data.description ?? null,
        category: data.category ?? null,
        price_cents: Math.round(data.priceRands * 100),
        stock: data.stock,
        images: data.imageUrl ? [data.imageUrl] : [],
        eco_attributes: data.ecoAttributes,
        is_branded: data.isBranded,
        brand_name: data.isBranded ? (data.brandName ?? null) : null,
        status: data.isBranded ? "pending_admin_review" : "approved",
      })
      .select("id, slug, status")
      .single();

    if (error) throw new Error(error.message);

    if (data.isBranded) {
      const { error: certError } = await supabase.from("brand_certificates").insert({
        product_id: product.id,
        seller_id: store.id,
        brand_name: data.brandName!,
        document_path: data.certificateDocumentPath!,
        certification_expiry_date: data.certificateExpiryDate || null,
        status: "pending",
      });
      if (certError) throw new Error(certError.message);
    }

    return { productId: product.id, status: product.status };
  });

export const startSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ returnUrl: z.string().url() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const { SUBSCRIPTION_FEE_CENTS } = await import("./eco");
    const { paystackKey, initializeSubscriptionCharge } = await import("./paystack.server");

    const { data: store } = await supabase
      .from("sellers")
      .select("id, store_name")
      .eq("user_id", userId)
      .maybeSingle();
    if (!store) throw new Error("Create your store first.");

    const reference = `sub_${store.id.slice(0, 8)}_${Date.now()}`;
    const periodStart = new Date();
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await supabase.from("subscription_payments").insert({
      seller_id: store.id,
      amount_cents: SUBSCRIPTION_FEE_CENTS,
      status: "pending",
      gateway_reference: reference,
      period_start: periodStart.toISOString().slice(0, 10),
      period_end: periodEnd.toISOString().slice(0, 10),
    });

    if (!paystackKey()) {
      return {
        gatewayConfigured: false,
        authorizationUrl: null as string | null,
        reference,
      };
    }

    const email = (claims as { email?: string }).email ?? "";
    const { authorizationUrl } = await initializeSubscriptionCharge({
      email,
      amountCents: SUBSCRIPTION_FEE_CENTS,
      reference,
      callbackUrl: data.returnUrl,
      sellerId: store.id,
    });

    return { gatewayConfigured: true, authorizationUrl, reference };
  });

/** Called when Paystack redirects the seller back to the dashboard. */
export const confirmSubscriptionPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ reference: z.string().min(4).max(120) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: store } = await supabase
      .from("sellers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!store) throw new Error("Create your store first.");

    // Only allow confirming a reference that belongs to this seller.
    const { data: payment } = await supabase
      .from("subscription_payments")
      .select("id")
      .eq("gateway_reference", data.reference)
      .eq("seller_id", store.id)
      .maybeSingle();
    if (!payment) return { activated: false as const, reason: "unknown_reference" as const };

    const { paystackKey, verifyTransaction } = await import("./paystack.server");
    if (!paystackKey()) return { activated: false as const, reason: "gateway_unconfigured" as const };

    const verified = await verifyTransaction(data.reference);
    if (verified.status !== "success") {
      return { activated: false as const, reason: "not_successful" as const };
    }

    const { activateSubscriptionForReference } = await import("./subscription.server");
    await activateSubscriptionForReference({
      reference: data.reference,
      amountCents: verified.amount,
    });
    return { activated: true as const };
  });
