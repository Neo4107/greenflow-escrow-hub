import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock, PackageCheck, Wallet } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listMyOrders, listMyPayouts } from "@/lib/orders.functions";
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
                  <Badge variant={order.status === "paid" ? "default" : "secondary"}>
                    {order.status}
                  </Badge>
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
