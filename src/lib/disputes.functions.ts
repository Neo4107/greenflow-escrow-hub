import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EVIDENCE_BUCKET = "dispute-evidence";

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

/** Buyer opens an RMA ticket against one line of their own paid order. */
export const openReturnRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        orderItemId: z.string().uuid(),
        reason: z.string().min(3).max(200),
        description: z.string().max(2000).optional(),
        requestedOutcome: z.enum(["refund", "replacement", "store_credit"]).default("refund"),
        itemDamaged: z.boolean().default(false),
        itemUsed: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: item, error } = await supabase
      .from("order_items")
      .select("id, order_id, seller_id, title, subtotal_cents, orders!inner(buyer_user_id, status)")
      .eq("id", data.orderItemId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!item) throw new Error("Order line not found");

    // Damaged or used goods skip the AI retention offer and go straight to an
    // admin dispute, per the returns protocol.
    const escalate = data.itemDamaged || data.itemUsed;

    const { data: ticket, error: insertError } = await supabase
      .from("return_requests")
      .insert({
        order_id: item.order_id,
        order_item_id: item.id,
        buyer_user_id: userId,
        seller_id: item.seller_id,
        reason: data.reason,
        description: data.description ?? null,
        requested_outcome: data.requestedOutcome,
        item_damaged: data.itemDamaged,
        item_used: data.itemUsed,
        status: escalate ? "escalated" : "open",
      })
      .select("id, status")
      .single();
    if (insertError) throw new Error(insertError.message);

    return { ticketId: ticket.id, status: ticket.status, escalated: escalate };
  });

/** Tickets the signed-in user opened (buyer view). */
export const listMyReturnRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("return_requests")
      .select("id, order_item_id, reason, status, requested_outcome, created_at")
      .order("created_at", { ascending: false });
    return { tickets: data ?? [] };
  });

/** Full dispute queue for the admin console. */
export const getDisputeQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { supabase } = context;

    const { data: tickets, error } = await supabase
      .from("return_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const orderIds = [...new Set((tickets ?? []).map((t) => t.order_id))];
    const sellerIds = [...new Set((tickets ?? []).map((t) => t.seller_id))];
    const itemIds = [...new Set((tickets ?? []).map((t) => t.order_item_id))];

    const [{ data: items }, { data: sellers }, { data: payouts }, { data: orders }] =
      await Promise.all([
        itemIds.length
          ? supabase
              .from("order_items")
              .select("id, title, quantity, subtotal_cents, payout_cents, commission_cents")
              .in("id", itemIds)
          : Promise.resolve({ data: [] as never[] }),
        sellerIds.length
          ? supabase.from("sellers").select("id, store_name, slug").in("id", sellerIds)
          : Promise.resolve({ data: [] as never[] }),
        orderIds.length
          ? supabase
              .from("seller_payouts")
              .select("id, order_id, seller_id, amount_cents, status, escrow_release_at")
              .in("order_id", orderIds)
          : Promise.resolve({ data: [] as never[] }),
        orderIds.length
          ? supabase
              .from("orders")
              .select("id, buyer_email, subtotal_cents, status, paid_at, gateway_reference")
              .in("id", orderIds)
          : Promise.resolve({ data: [] as never[] }),
      ]);

    const { data: evidence } = tickets?.length
      ? await supabase
          .from("dispute_evidence")
          .select("*")
          .in(
            "return_request_id",
            tickets.map((t) => t.id),
          )
          .order("created_at", { ascending: false })
      : { data: [] as never[] };

    return {
      tickets: tickets ?? [],
      items: items ?? [],
      sellers: sellers ?? [],
      payouts: payouts ?? [],
      orders: orders ?? [],
      evidence: evidence ?? [],
    };
  });

/** Signed URL so an admin can view a private evidence file. */
export const getEvidenceUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ path: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { data: signed, error } = await context.supabase.storage
      .from(EVIDENCE_BUCKET)
      .createSignedUrl(data.path, 300);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

/** Records an evidence file an admin has already uploaded to their own folder. */
export const attachDisputeEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ticketId: z.string().uuid(),
        filePath: z.string().min(1),
        fileType: z.string().max(120).optional(),
        caption: z.string().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { error } = await context.supabase.from("dispute_evidence").insert({
      return_request_id: data.ticketId,
      uploaded_by: context.userId,
      uploader_role: "admin",
      file_path: data.filePath,
      file_type: data.fileType ?? null,
      caption: data.caption ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin note / status move without a final resolution. */
export const updateDisputeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ticketId: z.string().uuid(),
        status: z.enum(["open", "ai_retention_offered", "awaiting_return", "escalated"]),
        adminNotes: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { error } = await context.supabase
      .from("return_requests")
      .update({
        status: data.status,
        ...(data.adminNotes === undefined ? {} : { admin_notes: data.adminNotes }),
      })
      .eq("id", data.ticketId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Final resolution. A refund (full or partial) reverses the seller's escrowed
 * 90% share before it can be released.
 */
export const resolveDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ticketId: z.string().uuid(),
        outcome: z.enum(["refund", "replacement", "store_credit", "reject"]),
        refundCents: z.number().int().min(0).default(0),
        summary: z.string().min(3).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabase, userId } = context;

    const { data: ticket, error } = await supabase
      .from("return_requests")
      .select("id, order_id, order_item_id, seller_id, status")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ticket) throw new Error("Ticket not found");

    const statusMap = {
      refund: "resolved_refund",
      replacement: "resolved_replacement",
      store_credit: "resolved_credit",
      reject: "rejected",
    } as const;

    let reversal: Awaited<ReturnType<typeof import("./disputes.server").reverseEscrowForDispute>> | null =
      null;

    if (data.outcome === "refund" && data.refundCents > 0) {
      const { reverseEscrowForDispute } = await import("./disputes.server");
      reversal = await reverseEscrowForDispute({
        orderId: ticket.order_id,
        sellerId: ticket.seller_id,
        refundCents: data.refundCents,
        reason: data.summary,
      });
    }

    const { error: updateError } = await supabase
      .from("return_requests")
      .update({
        status: statusMap[data.outcome],
        resolution_summary: data.summary,
        refund_amount_cents: data.outcome === "refund" ? data.refundCents : 0,
        resolved_by: userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", ticket.id);
    if (updateError) throw new Error(updateError.message);

    return { ok: true, reversal };
  });
