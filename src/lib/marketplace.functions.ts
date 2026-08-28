import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { createPublicSupabase } from "./public-supabase.server";

export const listProducts = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({ search: z.string().optional(), attribute: z.string().optional() })
      .default({})
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const supabase = createPublicSupabase();
    let query = supabase
      .from("products")
      .select("id, title, slug, price_cents, images, eco_attributes, category, stock, seller_id")
      .order("created_at", { ascending: false })
      .limit(48);

    if (data.search) query = query.ilike("title", `%${data.search}%`);
    if (data.attribute) query = query.contains("eco_attributes", [data.attribute]);

    const { data: products, error } = await query;
    if (error) return { products: [], stores: {} as Record<string, string>, error: error.message };

    const sellerIds = [...new Set((products ?? []).map((p) => p.seller_id))];
    const stores: Record<string, string> = {};
    if (sellerIds.length > 0) {
      const { data: sellers } = await supabase
        .from("sellers")
        .select("id, store_name")
        .in("id", sellerIds);
      for (const s of sellers ?? []) stores[s.id] = s.store_name;
    }

    return { products: products ?? [], stores, error: null as string | null };
  });

export const getProductBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const supabase = createPublicSupabase();
    const { data: product } = await supabase
      .from("products")
      .select(
        "id, title, slug, description, price_cents, images, eco_attributes, category, stock, brand_name, is_branded, seller_id",
      )
      .eq("slug", data.slug)
      .maybeSingle();

    if (!product) return { product: null, store: null };

    const { data: store } = await supabase
      .from("sellers")
      .select("id, store_name, slug, tagline, province, logo_url")
      .eq("id", product.seller_id)
      .maybeSingle();

    return { product, store: store ?? null };
  });

export const listStores = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createPublicSupabase();
  const { data } = await supabase
    .from("sellers")
    .select("id, store_name, slug, tagline, province, logo_url")
    .order("store_name")
    .limit(60);
  return { stores: data ?? [] };
});

export const getStoreBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const supabase = createPublicSupabase();
    const { data: store } = await supabase
      .from("sellers")
      .select("id, store_name, slug, tagline, description, province, logo_url")
      .eq("slug", data.slug)
      .maybeSingle();

    if (!store) return { store: null, products: [] };

    const { data: products } = await supabase
      .from("products")
      .select("id, title, slug, price_cents, images, eco_attributes, stock, seller_id")
      .eq("seller_id", store.id)
      .order("created_at", { ascending: false });

    return { store, products: products ?? [] };
  });
