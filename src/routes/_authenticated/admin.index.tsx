import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AlertTriangle, BadgeCheck, Coins, FileCheck2, Loader2, Store } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ESCROW_DAYS, formatRands } from "@/lib/eco";
import {
  getAdminOverview,
  getCertificateDownloadUrl,
  reviewCertificate,
  setSellerSubscriptionActive,
} from "@/lib/admin.functions";

const TICKET_LABELS: Record<string, string> = {
  open: "Open",
  ai_retention_offered: "AI retention offered",
  awaiting_return: "Awaiting return",
  escalated: "Escalated",
  resolved_refund: "Resolved — refund",
  resolved_replacement: "Resolved — replacement",
  resolved_credit: "Resolved — credit",
  rejected: "Rejected",
};

function isOpenTicket(status: string) {
  return !status.startsWith("resolved") && status !== "rejected";
}

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => {
    const title = "Admin dashboard — Rooted marketplace control";
    const description =
      "Monitor seller stores and outstanding R240 platform fee balances, review pending brand certificates, track escrow balances and work the dispute ticket backlog.";
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
  component: AdminDashboard,
});

function AdminDashboard() {
  const queryClient = useQueryClient();
  const fetchOverview = useServerFn(getAdminOverview);
  const review = useServerFn(reviewCertificate);
  const signCertificate = useServerFn(getCertificateDownloadUrl);
  const setActive = useServerFn(setSellerSubscriptionActive);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchOverview(),
    retry: false,
  });

  const sellerName = useMemo(() => {
    const map = new Map<string, string>();
    for (const seller of data?.sellers ?? []) map.set(seller.id, seller.store_name);
    return map;
  }, [data]);

  const productName = useMemo(() => {
    const map = new Map<string, string>();
    for (const product of data?.products ?? []) map.set(product.id, product.title);
    return map;
  }, [data]);

  const escrow = useMemo(() => {
    const payouts = data?.payouts ?? [];
    const perSeller = new Map<
      string,
      { escrowCents: number; releasableCents: number; paidCents: number; commissionCents: number }
    >();
    let heldCents = 0;
    let releasableCents = 0;
    let paidCents = 0;
    let commissionCents = 0;

    for (const payout of payouts) {
      const row = perSeller.get(payout.seller_id) ?? {
        escrowCents: 0,
        releasableCents: 0,
        paidCents: 0,
        commissionCents: 0,
      };
      row.commissionCents += payout.commission_cents;
      commissionCents += payout.commission_cents;
      if (payout.status === "escrow") {
        row.escrowCents += payout.amount_cents;
        heldCents += payout.amount_cents;
      } else if (payout.status === "releasable") {
        row.releasableCents += payout.amount_cents;
        releasableCents += payout.amount_cents;
      } else if (payout.status === "paid") {
        row.paidCents += payout.amount_cents;
        paidCents += payout.amount_cents;
      }
      perSeller.set(payout.seller_id, row);
    }

    const rows = [...perSeller.entries()]
      .map(([sellerId, totals]) => ({ sellerId, ...totals }))
      .sort((a, b) => b.escrowCents + b.releasableCents - (a.escrowCents + a.releasableCents));

    return { rows, heldCents, releasableCents, paidCents, commissionCents };
  }, [data]);

  const openTickets = (data?.tickets ?? []).filter((ticket) => isOpenTicket(ticket.status));
  const escalated = openTickets.filter((ticket) => ticket.status === "escalated");
  const activeSellers = (data?.sellers ?? []).filter((seller) => seller.is_active_subscription);
  const feesOutstandingCents = (data?.sellers ?? []).reduce(
    (sum, seller) => sum + (seller.outstanding_fee_cents ?? 0),
    0,
  );

  const reviewMutation = useMutation({
    mutationFn: async (input: { certificateId: string; approve: boolean }) =>
      review({ data: { certificateId: input.certificateId, approve: input.approve } }),
    onSuccess: (_result, input) => {
      toast.success(input.approve ? "Certificate approved" : "Certificate rejected");
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setBusyId(null),
  });

  const subscriptionMutation = useMutation({
    mutationFn: async (input: { sellerId: string; active: boolean }) => setActive({ data: input }),
    onSuccess: (_result, input) => {
      toast.success(input.active ? "Store unlocked" : "Store suspended");
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => setBusyId(null),
  });

  async function viewCertificate(path: string) {
    try {
      const { url } = await signCertificate({ data: { path } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-10">
        <header className="space-y-2">
          <h1 className="font-serif text-4xl font-semibold tracking-tight">Admin dashboard</h1>
          <p className="max-w-2xl text-muted-foreground">
            Marketplace control room: seller fee balances, brand certificate reviews, escrow
            positions and the dispute backlog.
          </p>
        </header>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading marketplace data…
          </div>
        ) : error ? (
          <Card>
            <CardHeader>
              <CardTitle>Admin access required</CardTitle>
              <CardDescription>{(error as Error).message}</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={<Store className="h-4 w-4" />}
                label="Stores listing"
                value={String(data?.sellers.length ?? 0)}
                hint={`${formatRands(feesOutstandingCents)} platform fees outstanding`}
              />
              <StatCard
                icon={<FileCheck2 className="h-4 w-4" />}
                label="Certificates pending"
                value={String(data?.certificates.length ?? 0)}
                hint="Branded listings awaiting proof review"
              />
              <StatCard
                icon={<Coins className="h-4 w-4" />}
                label="Escrow held"
                value={formatRands(escrow.heldCents)}
                hint={`${formatRands(escrow.releasableCents)} ready to release`}
              />
              <StatCard
                icon={<AlertTriangle className="h-4 w-4" />}
                label="Open disputes"
                value={String(openTickets.length)}
                hint={`${escalated.length} escalated to admin`}
              />
            </section>

            <Card>
              <CardHeader>
                <CardTitle>Commission earned</CardTitle>
                <CardDescription>
                  10% of every paid order, retained by the marketplace across all payouts.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-8">
                <Figure label="Total commission" value={formatRands(escrow.commissionCents)} />
                <Figure label="Seller escrow held" value={formatRands(escrow.heldCents)} />
                <Figure label="Releasable now" value={formatRands(escrow.releasableCents)} />
                <Figure label="Paid out" value={formatRands(escrow.paidCents)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pending brand certificates</CardTitle>
                <CardDescription>
                  Approve proof of authenticity before a branded product goes live.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(data?.certificates ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No certificates awaiting review.</p>
                ) : (
                  (data?.certificates ?? []).map((certificate) => (
                    <div
                      key={certificate.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
                    >
                      <div className="space-y-1">
                        <p className="font-medium">
                          {certificate.brand_name}
                          <span className="ml-2 text-sm text-muted-foreground">
                            {productName.get(certificate.product_id) ?? "Unknown product"}
                          </span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {sellerName.get(certificate.seller_id) ?? "Unknown store"} ·{" "}
                          {certificate.certification_expiry_date
                            ? `expires ${certificate.certification_expiry_date}`
                            : "no expiry given"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => viewCertificate(certificate.document_path)}
                        >
                          View document
                        </Button>
                        <Button
                          size="sm"
                          disabled={busyId === certificate.id}
                          onClick={() => {
                            setBusyId(certificate.id);
                            reviewMutation.mutate({
                              certificateId: certificate.id,
                              approve: true,
                            });
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={busyId === certificate.id}
                          onClick={() => {
                            setBusyId(certificate.id);
                            reviewMutation.mutate({
                              certificateId: certificate.id,
                              approve: false,
                            });
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Seller listings &amp; fee balances</CardTitle>
                <CardDescription>
                  Every store, its outstanding R240 platform fee balance and current escrow
                  position.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(data?.sellers ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sellers onboarded yet.</p>
                ) : (
                  (data?.sellers ?? []).map((seller) => {
                    const products = (data?.products ?? []).filter(
                      (product) => product.seller_id === seller.id,
                    );
                    const money = escrow.rows.find((row) => row.sellerId === seller.id);
                    return (
                      <div
                        key={seller.id}
                        className="space-y-3 rounded-lg border border-border p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="flex items-center gap-2 font-medium">
                              {seller.store_name}
                              {seller.outstanding_fee_cents > 0 ? (
                                <Badge variant="outline">
                                  {formatRands(seller.outstanding_fee_cents)} owing
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="gap-1">
                                  <BadgeCheck className="h-3 w-3" /> Settled
                                </Badge>
                              )}
                              {seller.fee_notice_90d_sent_at && (
                                <Badge variant="outline">90-day notice sent</Badge>
                              )}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {seller.province ?? "Province not set"} ·{" "}
                              {seller.contact_email ?? "no contact email"} · listing since{" "}
                              {new Date(seller.listing_started_at).toLocaleDateString("en-ZA")}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link
                              to="/store/$slug"
                              params={{ slug: seller.slug }}
                              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                            >
                              View store
                            </Link>
                            <Button
                              variant={seller.is_active_subscription ? "outline" : "default"}
                              size="sm"
                              disabled={busyId === seller.id}
                              onClick={() => {
                                setBusyId(seller.id);
                                subscriptionMutation.mutate({
                                  sellerId: seller.id,
                                  active: !seller.is_active_subscription,
                                });
                              }}
                            >
                              {seller.is_active_subscription ? "Suspend" : "Unlock"}
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-6 text-sm">
                          <Figure
                            label="Listings"
                            value={`${products.filter((p) => p.status === "approved").length} live / ${products.length} total`}
                          />
                          <Figure
                            label="Awaiting review"
                            value={String(
                              products.filter((p) => p.status === "pending_admin_review").length,
                            )}
                          />
                          <Figure label="In escrow" value={formatRands(money?.escrowCents ?? 0)} />
                          <Figure
                            label="Releasable"
                            value={formatRands(money?.releasableCents ?? 0)}
                          />
                          <Figure label="Paid out" value={formatRands(money?.paidCents ?? 0)} />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Dispute ticket backlog</CardTitle>
                <CardDescription>
                  Unresolved RMA tickets. Refunds reverse the seller&apos;s escrowed 90% inside the{" "}
                  {ESCROW_DAYS}-day window.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {openTickets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Backlog is clear.</p>
                ) : (
                  openTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
                    >
                      <div className="space-y-1">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          {ticket.reason}
                          <Badge variant="outline">
                            {TICKET_LABELS[ticket.status] ?? ticket.status}
                          </Badge>
                          {ticket.item_damaged ? (
                            <Badge variant="destructive">Damaged</Badge>
                          ) : null}
                          {ticket.item_used ? <Badge variant="secondary">Used</Badge> : null}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {sellerName.get(ticket.seller_id) ?? "Unknown store"} · wants{" "}
                          {ticket.requested_outcome.replace("_", " ")} · opened{" "}
                          {new Date(ticket.created_at).toLocaleDateString("en-ZA")}
                        </p>
                      </div>
                      <Link
                        to="/admin/disputes"
                        className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        Open in console
                      </Link>
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

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
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
      <CardContent>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
