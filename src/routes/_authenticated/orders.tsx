import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Clock, PackageCheck, Wallet } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { listMyOrders, listMyPayouts } from "@/lib/orders.functions";
import { openReturnRequest, listMyReturnRequests } from "@/lib/disputes.functions";
import { COMMISSION_RATE, ESCROW_DAYS, formatRands } from "@/lib/eco";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => {
    const title = "Orders & escrow — Rooted";
    const description =
      "Track your Rooted purchases and, if you sell, the 90% seller share moving through the 14-day escrow window.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: OrdersPage,
});

function OrdersPage() {
  const queryClient = useQueryClient();
  const submitTicket = useServerFn(openReturnRequest);
  const [reportingItemId, setReportingItemId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [damaged, setDamaged] = useState(false);
  const [used, setUsed] = useState(false);
  const [saving, setSaving] = useState(false);

  const tickets = useQuery({ queryKey: ["my-tickets"], queryFn: () => listMyReturnRequests() });

  async function report(orderItemId: string) {
    setSaving(true);
    try {
      const result = await submitTicket({
        data: {
          orderItemId,
          reason,
          description: details,
          requestedOutcome: "refund",
          itemDamaged: damaged,
          itemUsed: used,
        },
      });
      toast.success(
        result.escalated
          ? "Ticket opened and escalated to an admin for dispute review."
          : "Return ticket opened — we will be in touch shortly.",
      );
      setReportingItemId(null);
      setReason("");
      setDetails("");
      setDamaged(false);
      setUsed(false);
      void queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open the ticket.");
    } finally {
      setSaving(false);
    }
  }

  const orders = useQuery({ queryKey: ["my-orders"], queryFn: () => listMyOrders() });
  const payouts = useQuery({ queryKey: ["my-payouts"], queryFn: () => listMyPayouts() });

  const totals = payouts.data?.totals;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-10">
        <header>
          <h1 className="font-serif text-4xl">Orders &amp; escrow</h1>
          <p className="mt-2 text-muted-foreground">
            Every payment splits {Math.round(COMMISSION_RATE * 100)}% to the marketplace right away;
            the seller&apos;s share is released {ESCROW_DAYS} days later.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-primary" /> My purchases
            </CardTitle>
            <CardDescription>Orders you placed on Rooted.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {orders.isLoading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : (orders.data?.orders.length ?? 0) === 0 ? (
              <p className="text-muted-foreground">No orders yet.</p>
            ) : (
              orders.data!.orders.map((order) => (
                <div
                  key={order.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"
                >
                  <div>
                    <p className="font-medium">
                      {(orders.data!.items ?? [])
                        .filter((item) => item.order_id === order.id)
                        .map((item) => `${item.quantity} × ${item.title}`)
                        .join(", ") || order.gateway_reference}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString("en-ZA")} ·{" "}
                      {formatRands(order.subtotal_cents)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={order.status === "paid" ? "default" : "secondary"}>
                      {order.status}
                    </Badge>
                    {order.status === "paid" ? (
                      <div className="flex flex-col items-end gap-2">
                        {(orders.data!.items ?? [])
                          .filter((item) => item.order_id === order.id)
                          .map((item) => {
                            const existing = (tickets.data?.tickets ?? []).find(
                              (ticket) => ticket.order_item_id === item.id,
                            );
                            if (existing) {
                              return (
                                <Badge key={item.id} variant="outline">
                                  Return: {existing.status.replace(/_/g, " ")}
                                </Badge>
                              );
                            }
                            return reportingItemId === item.id ? (
                              <div
                                key={item.id}
                                className="w-72 space-y-3 rounded-xl border border-border p-3 text-left"
                              >
                                <div className="space-y-1">
                                  <Label htmlFor={`reason-${item.id}`}>What went wrong?</Label>
                                  <Input
                                    id={`reason-${item.id}`}
                                    value={reason}
                                    onChange={(event) => setReason(event.target.value)}
                                    placeholder="e.g. Arrived cracked"
                                  />
                                </div>
                                <Textarea
                                  value={details}
                                  onChange={(event) => setDetails(event.target.value)}
                                  placeholder="Any extra detail for the seller"
                                  rows={2}
                                />
                                <label className="flex items-center gap-2 text-sm">
                                  <Checkbox
                                    checked={damaged}
                                    onCheckedChange={(value) => setDamaged(value === true)}
                                  />
                                  Item arrived damaged
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                  <Checkbox
                                    checked={used}
                                    onCheckedChange={(value) => setUsed(value === true)}
                                  />
                                  Item was clearly used
                                </label>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    disabled={saving || reason.trim().length < 3}
                                    onClick={() => void report(item.id)}
                                  >
                                    Submit
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setReportingItemId(null)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <Button
                                key={item.id}
                                size="sm"
                                variant="outline"
                                onClick={() => setReportingItemId(item.id)}
                              >
                                Report a problem
                              </Button>
                            );
                          })}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {payouts.data && (payouts.data.payouts.length > 0 || totals) ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" /> Seller escrow ledger
              </CardTitle>
              <CardDescription>
                Held in escrow: {formatRands(totals?.escrow ?? 0)} · Ready to pay out:{" "}
                {formatRands(totals?.releasable ?? 0)} · Paid: {formatRands(totals?.paid ?? 0)} ·
                Commission retained: {formatRands(totals?.commission ?? 0)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {payouts.data.payouts.length === 0 ? (
                <p className="text-muted-foreground">No sales yet.</p>
              ) : (
                payouts.data.payouts.map((payout) => (
                  <div
                    key={payout.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"
                  >
                    <div>
                      <p className="font-medium">{formatRands(payout.amount_cents)} to you</p>
                      <p className="text-sm text-muted-foreground">
                        Gross {formatRands(payout.gross_cents)} · commission{" "}
                        {formatRands(payout.commission_cents)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {new Date(payout.escrow_release_at).toLocaleDateString("en-ZA")}
                      <Badge variant={payout.status === "escrow" ? "secondary" : "default"}>
                        {payout.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  );
}
