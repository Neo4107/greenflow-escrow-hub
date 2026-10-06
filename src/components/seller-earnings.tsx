import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FULFILMENT_LABELS, courierTrackingUrl } from "@/lib/fulfilment";
import { useServerFn } from "@tanstack/react-start";
import { Banknote, Clock, Lock, Receipt, Wallet } from "lucide-react";

import { listMyPayouts, updateFulfilment } from "@/lib/orders.functions";
import { formatRands } from "@/lib/eco";

const payoutLabels: Record<string, { label: string; className: string }> = {
  escrow: { label: "In escrow", className: "bg-secondary text-secondary-foreground" },
  releasable: { label: "Ready to pay", className: "bg-primary/15 text-primary" },
  paid: { label: "Paid out", className: "bg-primary text-primary-foreground" },
  withheld: { label: "On hold", className: "bg-muted text-muted-foreground" },
  refunded: { label: "Refunded", className: "bg-destructive/15 text-destructive" },
  reversed: { label: "Reversed", className: "bg-destructive/15 text-destructive" },
};

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "—";

export function SellerEarnings() {
  const fetchPayouts = useServerFn(listMyPayouts);
  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["my-payouts"],
    queryFn: () => fetchPayouts(),
    refetchInterval: 30_000,
  });

  if (isLoading || !data) {
    return <div className="h-48 animate-pulse rounded-2xl border border-border bg-card" />;
  }

  const { totals, payouts, sales } = data;
  const stats = [
    { label: "Total sales", value: totals.gross, icon: Receipt },
    { label: "Held in escrow", value: totals.escrow, icon: Lock },
    { label: "Ready to pay", value: totals.releasable, icon: Clock },
    { label: "Paid out", value: totals.paid, icon: Banknote },
  ];

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-serif text-xl font-semibold">
          <Wallet className="h-5 w-5 text-primary" /> Sales & payouts
        </h2>
        <span className="text-xs text-muted-foreground">
          Live · updated {new Date(dataUpdatedAt).toLocaleTimeString("en-ZA")}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-background p-4">
            <s.icon className="h-4 w-4 text-muted-foreground" />
            <p className="mt-2 text-xs text-muted-foreground">{s.label}</p>
            <p className="font-serif text-xl font-semibold">{formatRands(s.value)}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-2 rounded-xl bg-muted p-4 text-sm sm:grid-cols-3">
        <p>
          10% commission: <strong>{formatRands(totals.commission)}</strong>
        </p>
        <p>
          Platform fees taken from sales: <strong>{formatRands(totals.fees)}</strong>
        </p>
        <p>
          Reversed / refunded: <strong>{formatRands(totals.reversed)}</strong>
        </p>
      </div>

      <h3 className="mt-6 font-medium">Payout history</h3>
      {payouts.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No sales yet. When a buyer pays, your earnings appear here and are held for 14 days.
        </p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Sold</th>
                <th className="py-2 pr-3">Sale</th>
                <th className="py-2 pr-3">Commission</th>
                <th className="py-2 pr-3">Fees</th>
                <th className="py-2 pr-3">You get</th>
                <th className="py-2 pr-3">Release date</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => {
                const s = payoutLabels[p.status] ?? {
                  label: p.status,
                  className: "bg-muted text-muted-foreground",
                };
                return (
                  <tr key={p.id} className="border-t border-border">
                    <td className="py-2 pr-3">{fmtDate(p.created_at)}</td>
                    <td className="py-2 pr-3">{formatRands(p.gross_cents)}</td>
                    <td className="py-2 pr-3">−{formatRands(p.commission_cents)}</td>
                    <td className="py-2 pr-3">−{formatRands(p.fee_deducted_cents)}</td>
                    <td className="py-2 pr-3 font-medium">{formatRands(p.amount_cents)}</td>
                    <td className="py-2 pr-3">
                      {p.status === "paid" ? fmtDate(p.paid_at) : fmtDate(p.escrow_release_at)}
                    </td>
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${s.className}`}>
                        {s.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {sales.length > 0 && (
        <>
          <h3 className="mt-6 font-medium">Recent items sold</h3>
          <ul className="mt-2 divide-y divide-border text-sm">
            {sales.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {s.title} × {s.quantity}
                  <span className="ml-2 text-xs text-muted-foreground">{fmtDate(s.created_at)}</span>
                  <span className="ml-2">{formatRands(s.subtotal_cents)}</span>
                </span>
                <FulfilmentControl sale={s} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

type Sale = {
  id: string;
  fulfilment_status: string;
  courier_waybill: string | null;
  orders: { status: string } | null;
};

function FulfilmentControl({ sale }: { sale: Sale }) {
  const update = useServerFn(updateFulfilment);
  const queryClient = useQueryClient();
  const [waybill, setWaybill] = useState("");
  const [busy, setBusy] = useState(false);

  if (sale.orders?.status !== "paid") {
    return <span className="text-xs text-muted-foreground">Not paid yet</span>;
  }

  async function go(status: "packed" | "dispatched" | "delivered") {
    setBusy(true);
    try {
      await update({ data: { orderItemId: sale.id, status, waybill: waybill || undefined } });
      toast.success(`Marked as ${(FULFILMENT_LABELS[status] ?? status).toLowerCase()}`);
      void queryClient.invalidateQueries({ queryKey: ["my-payouts"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">{FULFILMENT_LABELS[sale.fulfilment_status]}</span>
      {sale.courier_waybill ? (
        <a className="text-xs text-primary underline" href={courierTrackingUrl(sale.courier_waybill)} target="_blank" rel="noreferrer">
          Waybill {sale.courier_waybill}
        </a>
      ) : null}
      {sale.fulfilment_status === "awaiting_packing" && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void go("packed")}>Mark packed</Button>
      )}
      {sale.fulfilment_status === "packed" && (
        <>
          <Input className="h-8 w-40" placeholder="Courier Guy waybill" value={waybill} onChange={(e) => setWaybill(e.target.value)} />
          <Button size="sm" variant="outline" disabled={busy || !waybill.trim()} onClick={() => void go("dispatched")}>Dispatch</Button>
        </>
      )}
      {sale.fulfilment_status === "dispatched" && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void go("delivered")}>Mark delivered</Button>
      )}
    </div>
  );
}
