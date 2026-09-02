import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, FileUp, Loader2, Paperclip, ShieldAlert, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { ESCROW_DAYS, formatRands } from "@/lib/eco";
import {
  attachDisputeEvidence,
  getDisputeQueue,
  getEvidenceUrl,
  resolveDispute,
  updateDisputeStatus,
} from "@/lib/disputes.functions";

const EVIDENCE_BUCKET = "dispute-evidence";

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  ai_retention_offered: "AI retention offered",
  awaiting_return: "Awaiting return",
  escalated: "Escalated to admin",
  resolved_refund: "Resolved — refunded",
  resolved_replacement: "Resolved — replacement",
  resolved_credit: "Resolved — store credit",
  rejected: "Rejected",
};

export const Route = createFileRoute("/_authenticated/admin/disputes")({
  head: () => {
    const title = "Dispute console — Rooted admin";
    const description =
      "Review RMA tickets, attach evidence and resolve buyer–seller disputes, reversing escrowed seller payouts when a refund is granted.";
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
  component: DisputeConsole,
});

function DisputeConsole() {
  const queryClient = useQueryClient();
  const fetchQueue = useServerFn(getDisputeQueue);
  const attachEvidence = useServerFn(attachDisputeEvidence);
  const openEvidence = useServerFn(getEvidenceUrl);
  const resolve = useServerFn(resolveDispute);
  const setStatus = useServerFn(updateDisputeStatus);

  const [filter, setFilter] = useState<"all" | "open" | "resolved">("open");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"refund" | "replacement" | "store_credit" | "reject">(
    "refund",
  );
  const [refundRands, setRefundRands] = useState("");
  const [summary, setSummary] = useState("");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-disputes"],
    queryFn: () => fetchQueue(),
    retry: false,
  });

  const tickets = useMemo(() => {
    const all = data?.tickets ?? [];
    if (filter === "all") return all;
    const resolved = (status: string) => status.startsWith("resolved") || status === "rejected";
    return all.filter((ticket) => (filter === "resolved" ? resolved(ticket.status) : !resolved(ticket.status)));
  }, [data, filter]);

  const active = (data?.tickets ?? []).find((ticket) => ticket.id === activeId) ?? null;
  const activeItem = data?.items.find((item) => item.id === active?.order_item_id) ?? null;
  const activeStore = data?.sellers.find((seller) => seller.id === active?.seller_id) ?? null;
  const activeOrder = data?.orders.find((order) => order.id === active?.order_id) ?? null;
  const activePayout =
    data?.payouts.find(
      (payout) => payout.order_id === active?.order_id && payout.seller_id === active?.seller_id,
    ) ?? null;
  const activeEvidence = (data?.evidence ?? []).filter(
    (row) => row.return_request_id === active?.id,
  );

  const resolveMutation = useMutation({
    mutationFn: async () => {
      if (!active) throw new Error("Pick a ticket first");
      const cents =
        outcome === "refund" ? Math.round(Number(refundRands.replace(",", ".") || "0") * 100) : 0;
      return resolve({
        data: { ticketId: active.id, outcome, refundCents: cents, summary },
      });
    },
    onSuccess: (result) => {
      const reversal = result.reversal;
      toast.success(
        reversal?.reversed
          ? reversal.fullReversal
            ? "Dispute resolved — the seller's escrowed payout was reversed in full."
            : `Dispute resolved — ${formatRands(reversal.remainingEscrowCents)} left in escrow.`
          : reversal?.reason === "already_paid"
            ? "Dispute resolved — payout had already been paid, flagged for manual recovery."
            : "Dispute resolved.",
      );
      setSummary("");
      setRefundRands("");
      void queryClient.invalidateQueries({ queryKey: ["admin-disputes"] });
    },
    onError: (mutationError) =>
      toast.error(mutationError instanceof Error ? mutationError.message : "Resolution failed."),
  });

  async function handleUpload(file: File) {
    if (!active) return;
    setUploading(true);
    try {
      const { data: session } = await supabase.auth.getUser();
      const uid = session.user?.id;
      if (!uid) throw new Error("Session expired");
      const path = `${uid}/${active.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage
        .from(EVIDENCE_BUCKET)
        .upload(path, file, { upsert: false });
      if (uploadError) throw new Error(uploadError.message);
      await attachEvidence({
        data: {
          ticketId: active.id,
          filePath: path,
          fileType: file.type || "application/octet-stream",
          ...(caption ? { caption } : {}),
        },
      });
      setCaption("");
      if (fileRef.current) fileRef.current.value = "";
      toast.success("Evidence attached to the ticket.");
      void queryClient.invalidateQueries({ queryKey: ["admin-disputes"] });
    } catch (uploadError) {
      toast.error(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function viewEvidence(path: string) {
    try {
      const { url } = await openEvidence({ data: { path } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Could not open that file.");
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 font-serif text-3xl">Admins only</h1>
          <p className="mt-2 text-muted-foreground">
            This console is limited to marketplace administrators.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl">Dispute console</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Review RMA tickets, attach evidence and resolve disputes. A refund reverses the
              seller&apos;s escrowed 90% share before the {ESCROW_DAYS}-day window closes.
            </p>
          </div>
          <Select value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Needs action</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="all">All tickets</SelectItem>
            </SelectContent>
          </Select>
        </header>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>RMA tickets</CardTitle>
              <CardDescription>{tickets.length} ticket(s)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                <p className="text-muted-foreground">Loading queue…</p>
              ) : tickets.length === 0 ? (
                <p className="text-muted-foreground">Nothing in this view.</p>
              ) : (
                tickets.map((ticket) => {
                  const store = data?.sellers.find((seller) => seller.id === ticket.seller_id);
                  return (
                    <button
                      key={ticket.id}
                      onClick={() => setActiveId(ticket.id)}
                      className={`w-full rounded-xl border p-3 text-left transition-colors ${
                        activeId === ticket.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="line-clamp-1 font-medium">{ticket.reason}</span>
                        {(ticket.item_damaged || ticket.item_used) && (
                          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {store?.store_name ?? "Unknown store"} ·{" "}
                        {new Date(ticket.created_at).toLocaleDateString("en-ZA")}
                      </p>
                      <Badge variant="secondary" className="mt-2">
                        {STATUS_LABELS[ticket.status] ?? ticket.status}
                      </Badge>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          {!active ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                Select a ticket to review it.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{active.reason}</CardTitle>
                  <CardDescription>
                    {activeStore?.store_name ?? "Unknown store"} · order{" "}
                    {activeOrder?.gateway_reference ?? active.order_id.slice(0, 8)} ·{" "}
                    {activeOrder?.buyer_email ?? "buyer"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {active.description ? (
                    <p className="text-muted-foreground">{active.description}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">Wants: {active.requested_outcome}</Badge>
                    {active.item_damaged && <Badge variant="destructive">Damaged on arrival</Badge>}
                    {active.item_used && <Badge variant="destructive">Used item</Badge>}
                    <Badge variant="outline">{STATUS_LABELS[active.status] ?? active.status}</Badge>
                  </div>
                  <dl className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <dt className="text-muted-foreground">Item</dt>
                      <dd>
                        {activeItem
                          ? `${activeItem.quantity} × ${activeItem.title} — ${formatRands(activeItem.subtotal_cents)}`
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Seller escrow</dt>
                      <dd>
                        {activePayout
                          ? `${formatRands(activePayout.amount_cents)} (${activePayout.status}), releases ${new Date(activePayout.escrow_release_at).toLocaleDateString("en-ZA")}`
                          : "No payout row"}
                      </dd>
                    </div>
                  </dl>
                  {active.resolution_summary ? (
                    <p className="rounded-xl bg-muted p-3">
                      <span className="font-medium">Resolution:</span> {active.resolution_summary}
                      {active.refund_amount_cents > 0
                        ? ` (${formatRands(active.refund_amount_cents)} refunded)`
                        : ""}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setStatus({ data: { ticketId: active.id, status: "awaiting_return" } })
                            .then(() => {
                              toast.success("Marked as awaiting return.");
                              return queryClient.invalidateQueries({ queryKey: ["admin-disputes"] });
                            })
                            .catch(() => toast.error("Could not update the ticket."))
                        }
                      >
                        Awaiting return
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setStatus({ data: { ticketId: active.id, status: "escalated" } })
                            .then(() => {
                              toast.success("Escalated.");
                              return queryClient.invalidateQueries({ queryKey: ["admin-disputes"] });
                            })
                            .catch(() => toast.error("Could not update the ticket."))
                        }
                      >
                        Escalate
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Paperclip className="h-5 w-5 text-primary" /> Evidence
                  </CardTitle>
                  <CardDescription>
                    Photos and documents from the buyer, the seller or your own investigation.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {activeEvidence.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No evidence attached yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {activeEvidence.map((row) => (
                        <li
                          key={row.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3 text-sm"
                        >
                          <span>
                            <span className="font-medium">{row.caption || row.file_path.split("/").pop()}</span>
                            <span className="ml-2 text-muted-foreground">
                              by {row.uploader_role} ·{" "}
                              {new Date(row.created_at).toLocaleDateString("en-ZA")}
                            </span>
                          </span>
                          <Button size="sm" variant="outline" onClick={() => viewEvidence(row.file_path)}>
                            View
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div className="space-y-2">
                      <Label htmlFor="caption">Caption (optional)</Label>
                      <Input
                        id="caption"
                        value={caption}
                        onChange={(event) => setCaption(event.target.value)}
                        placeholder="e.g. Courier photo of damaged packaging"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="evidence">Upload</Label>
                      <Input
                        id="evidence"
                        ref={fileRef}
                        type="file"
                        accept="image/*,application/pdf"
                        disabled={uploading}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void handleUpload(file);
                        }}
                      />
                    </div>
                  </div>
                  {uploading ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                    </p>
                  ) : (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FileUp className="h-3.5 w-3.5" /> Images or PDF, up to 20MB. Files stay
                      private to this dispute.
                    </p>
                  )}
                </CardContent>
              </Card>

              {!active.resolution_summary ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Undo2 className="h-5 w-5 text-primary" /> Resolve dispute
                    </CardTitle>
                    <CardDescription>
                      A refund reverses the seller&apos;s escrowed share; a partial refund leaves the
                      remainder in escrow.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Outcome</Label>
                        <Select
                          value={outcome}
                          onValueChange={(value) => setOutcome(value as typeof outcome)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="refund">Refund buyer (reverse escrow)</SelectItem>
                            <SelectItem value="replacement">Replacement</SelectItem>
                            <SelectItem value="store_credit">Store credit</SelectItem>
                            <SelectItem value="reject">Reject claim</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {outcome === "refund" ? (
                        <div className="space-y-2">
                          <Label htmlFor="refund">Refund amount (R)</Label>
                          <Input
                            id="refund"
                            inputMode="decimal"
                            value={refundRands}
                            onChange={(event) => setRefundRands(event.target.value)}
                            placeholder={
                              activeItem ? (activeItem.subtotal_cents / 100).toFixed(2) : "0.00"
                            }
                          />
                        </div>
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="summary">Resolution notes</Label>
                      <Textarea
                        id="summary"
                        value={summary}
                        onChange={(event) => setSummary(event.target.value)}
                        placeholder="What was decided and why."
                        rows={3}
                      />
                    </div>
                    <Button
                      onClick={() => resolveMutation.mutate()}
                      disabled={resolveMutation.isPending || summary.trim().length < 3}
                    >
                      {resolveMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Resolve &amp; apply
                    </Button>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
