import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, PackageSearch, ShieldQuestion, ShoppingBag, Sprout } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRands } from "@/lib/eco";
import { getMyBuyerAccount, updateMyProfile } from "@/lib/account.functions";

const TICKET_LABELS: Record<string, string> = {
  open: "Open",
  ai_retention_offered: "Offer sent to you",
  awaiting_return: "Awaiting return",
  escalated: "With our support team",
  resolved_refund: "Refunded",
  resolved_replacement: "Replacement sent",
  resolved_credit: "Store credit issued",
  rejected: "Declined",
};

export const Route = createFileRoute("/_authenticated/account")({
  head: () => {
    const title = "My account — Rooted eco marketplace";
    const description =
      "Manage your Rooted buyer profile, review your eco purchases and follow the return or dispute tickets you have opened.";
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
  component: AccountPage,
});

function AccountPage() {
  const queryClient = useQueryClient();
  const fetchAccount = useServerFn(getMyBuyerAccount);
  const saveProfile = useServerFn(updateMyProfile);
  const [fullName, setFullName] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["buyer-account"],
    queryFn: () => fetchAccount(),
    retry: false,
  });

  useEffect(() => {
    if (data?.profile?.full_name) setFullName(data.profile.full_name);
  }, [data?.profile?.full_name]);

  const saveMutation = useMutation({
    mutationFn: async () => saveProfile({ data: { fullName } }),
    onSuccess: () => {
      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: ["buyer-account"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const itemsByOrder = (orderId: string) =>
    (data?.items ?? []).filter((item) => item.order_id === orderId);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-10">
        <header className="space-y-2">
          <h1 className="font-serif text-4xl font-semibold tracking-tight">My account</h1>
          <p className="text-muted-foreground">
            Your details, your eco purchases and any return or dispute tickets you have opened.
          </p>
        </header>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your account…
          </div>
        ) : error ? (
          <Card>
            <CardHeader>
              <CardTitle>We could not load your account</CardTitle>
              <CardDescription>{(error as Error).message}</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-3">
              <Stat
                icon={<ShoppingBag className="h-4 w-4" />}
                label="Paid orders"
                value={String(data?.totals.orderCount ?? 0)}
              />
              <Stat
                icon={<Sprout className="h-4 w-4" />}
                label="Total spent"
                value={formatRands(data?.totals.spentCents ?? 0)}
              />
              <Stat
                icon={<ShieldQuestion className="h-4 w-4" />}
                label="Open tickets"
                value={String(data?.totals.openTickets ?? 0)}
              />
            </section>

            <Card>
              <CardHeader>
                <CardTitle>Your details</CardTitle>
                <CardDescription>
                  Signed in as {data?.profile?.email ?? "your account email"}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="max-w-sm space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending || fullName.trim().length < 2}
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Save profile
                  </Button>
                  {(data?.roles ?? []).map((role) => (
                    <Badge key={role} variant="secondary">
                      {role}
                    </Badge>
                  ))}
                </div>
                {data?.store ? (
                  <p className="text-sm text-muted-foreground">
                    You also run{" "}
                    <Link
                      to="/store/$slug"
                      params={{ slug: data.store.slug }}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {data.store.store_name}
                    </Link>{" "}
                    — manage listings in the{" "}
                    <Link to="/dashboard" className="text-primary underline-offset-4 hover:underline">
                      seller dashboard
                    </Link>
                    .
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Want to sell your own eco products?{" "}
                    <Link to="/dashboard" className="text-primary underline-offset-4 hover:underline">
                      Open a store
                    </Link>{" "}
                    for R240/month.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent purchases</CardTitle>
                <CardDescription>
                  Need help with an item? Open a ticket from your{" "}
                  <Link to="/orders" className="text-primary underline-offset-4 hover:underline">
                    orders page
                  </Link>
                  .
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(data?.orders ?? []).length === 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border p-6">
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <PackageSearch className="h-4 w-4" /> No orders yet.
                    </p>
                    <Link
                      to="/"
                      className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      Browse the marketplace
                    </Link>
                  </div>
                ) : (
                  (data?.orders ?? []).map((order) => (
                    <div key={order.id} className="rounded-lg border border-border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">
                          {itemsByOrder(order.id)
                            .map((item) => `${item.title} ×${item.quantity}`)
                            .join(", ") || "Order"}
                        </p>
                        <Badge variant={order.status === "paid" ? "secondary" : "outline"}>
                          {order.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatRands(order.subtotal_cents)} ·{" "}
                        {new Date(order.created_at).toLocaleDateString("en-ZA")} · ref{" "}
                        {order.gateway_reference}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>My tickets</CardTitle>
                <CardDescription>
                  Returns, refunds and disputes you have opened. Damaged or used items are escalated
                  to our support team automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(data?.tickets ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tickets open — happy shopping.</p>
                ) : (
                  (data?.tickets ?? []).map((ticket) => (
                    <div
                      key={ticket.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
                    >
                      <div>
                        <p className="font-medium">{ticket.reason}</p>
                        <p className="text-sm text-muted-foreground">
                          Wants {ticket.requested_outcome.replace("_", " ")} · opened{" "}
                          {new Date(ticket.created_at).toLocaleDateString("en-ZA")}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {TICKET_LABELS[ticket.status] ?? ticket.status}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          {icon}
          {label}
        </CardDescription>
        <CardTitle className="font-serif text-3xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
