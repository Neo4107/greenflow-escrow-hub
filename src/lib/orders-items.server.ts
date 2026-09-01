/** Server-only writer for order lines (buyers never write these directly). */
export async function insertOrderItems(params: {
  orderId: string;
  items: Array<{
    productId: string;
    sellerId: string;
    title: string;
    unitPriceCents: number;
    quantity: number;
    subtotalCents: number;
    commissionCents: number;
    payoutCents: number;
  }>;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { error } = await supabaseAdmin.from("order_items").insert(
    params.items.map((item) => ({
      order_id: params.orderId,
      product_id: item.productId,
      seller_id: item.sellerId,
      title: item.title,
      unit_price_cents: item.unitPriceCents,
      quantity: item.quantity,
      subtotal_cents: item.subtotalCents,
      commission_cents: item.commissionCents,
      payout_cents: item.payoutCents,
    })),
  );
  if (error) throw new Error(error.message);
}
