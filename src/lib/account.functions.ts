import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Buyer account snapshot: profile, roles, purchase history and dispute tickets. */
export const getMyBuyerAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: roles }, { data: orders }, { data: tickets }, { data: store }] =
      await Promise.all([
        supabase.from("profiles").select("id, full_name, email, created_at").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase
          .from("orders")
          .select("id, gateway_reference, status, subtotal_cents, paid_at, created_at")
          .eq("buyer_user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("return_requests")
          .select("id, order_id, order_item_id, reason, status, requested_outcome, created_at")
          .eq("buyer_user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase.from("sellers").select("id, store_name, slug").eq("user_id", userId).maybeSingle(),
      ]);

    const orderIds = (orders ?? []).map((order) => order.id);
    const { data: items } = orderIds.length
      ? await supabase
          .from("order_items")
          .select("id, order_id, title, quantity, subtotal_cents")
          .in("order_id", orderIds)
      : { data: [] };

    const paid = (orders ?? []).filter((order) => order.status === "paid");

    return {
      profile: profile ?? null,
      roles: (roles ?? []).map((row) => row.role),
      orders: orders ?? [],
      items: items ?? [],
      tickets: tickets ?? [],
      store: store ?? null,
      totals: {
        orderCount: paid.length,
        spentCents: paid.reduce((sum, order) => sum + order.subtotal_cents, 0),
        openTickets: (tickets ?? []).filter(
          (ticket) => !ticket.status.startsWith("resolved") && ticket.status !== "rejected",
        ).length,
      },
    };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ fullName: z.string().min(2).max(80) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ full_name: data.fullName })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
