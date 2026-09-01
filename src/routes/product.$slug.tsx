import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Leaf, Loader2, ShieldCheck, Store } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getProductBySlug } from "@/lib/marketplace.functions";
import { startOrderCheckout, confirmOrderPayment } from "@/lib/orders.functions";
import { COMMISSION_RATE, ECO_LABELS, ESCROW_DAYS, commissionBreakdown, formatRands } from "@/lib/eco";

export const Route = createFileRoute("/product/$slug")({
  head: ({ params }) => {
    const name = params.slug.replace(/-/g, " ");
    const title = `${name} — Rooted eco marketplace`;
    const description = `Buy ${name} from a verified South African eco seller on Rooted. Payment is protected by a ${ESCROW_DAYS}-day escrow window.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);

  const checkout = useServerFn(startOrderCheckout);
  const confirm = useServerFn(confirmOrderPayment);

  const { data, isLoading } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => getProductBySlug({ data: { slug } }),
  });

  // Paystack redirects back with ?reference=... — confirm so escrow starts now.
  useEffect(() => {
    const reference = new URLSearchParams(window.location.search).get("reference");
    if (!reference) return;
    confirm({ data: { reference } })
      .then((result) => {
        if (result.paid) {
          toast.success(
            `Payment received. The seller's share is held in escrow for ${ESCROW_DAYS} days.`,
          );
        } else {
          toast.error("We could not confirm that payment yet.");
        }
      })
      .catch(() => toast.error("We could not confirm that payment yet."))
      .finally(() => {
        window.history.replaceState({}, "", window.location.pathname);
        void router.invalidate();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const product = data?.product ?? null;
  const store = data?.store ?? null;
  const split = product ? commissionBreakdown(product.price_cents * quantity) : null;

  async function buyNow() {
    setBusy(true);
    try {
      const result = await checkout({
        data: { productSlug: slug, quantity, returnUrl: window.location.origin + `/product/${slug}` },
      });
      if (result.gatewayConfigured && result.authorizationUrl) {
        window.location.href = result.authorizationUrl;
        return;
      }
      toast.error("Card payments aren't switched on yet — the payment key is still missing.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Checkout failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        {isLoading ? (
          <p className="text-muted-foreground">Loading listing…</p>
        ) : !product ? (
          <div className="space-y-4">
            <h1 className="font-serif text-3xl">Listing not available</h1>
            <p className="text-muted-foreground">
              This product may be unapproved, sold out, or from a store with an inactive
              subscription.
            </p>
            <Link to="/" className="text-primary underline">
              Back to the marketplace
            </Link>
          </div>
        ) : (
          <div className="grid gap-10 md:grid-cols-2">
            <div className="overflow-hidden rounded-3xl border border-border bg-muted">
              {product.images?.[0] ? (
                <img
                  src={product.images[0]}
                  alt={product.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-80 items-center justify-center text-muted-foreground">
                  <Leaf className="h-10 w-10" />
                </div>
              )}
            </div>

            <div className="space-y-5">
              <h1 className="font-serif text-4xl leading-tight">{product.title}</h1>
              {store ? (
                <Link
                  to="/store/$slug"
                  params={{ slug: store.slug }}
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  <Store className="h-4 w-4" /> {store.store_name}
                </Link>
              ) : null}
              <p className="text-3xl font-semibold">{formatRands(product.price_cents)}</p>
              {product.description ? (
                <p className="text-muted-foreground">{product.description}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {(product.eco_attributes ?? []).map((attribute) => (
                  <Badge key={attribute} variant="secondary">
                    {ECO_LABELS[attribute] ?? attribute}
                  </Badge>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <label htmlFor="qty" className="text-sm text-muted-foreground">
                  Quantity
                </label>
                <input
                  id="qty"
                  type="number"
                  min={1}
                  max={Math.max(1, product.stock)}
                  value={quantity}
                  onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
                  className="w-20 rounded-md border border-input bg-background px-3 py-2"
                />
                <span className="text-sm text-muted-foreground">{product.stock} in stock</span>
              </div>

              <Button onClick={buyNow} disabled={busy || product.stock < 1} size="lg">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {product.stock < 1 ? "Sold out" : `Pay ${formatRands(product.price_cents * quantity)}`}
              </Button>

              {split ? (
                <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2 font-medium text-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" /> Protected payment
                  </p>
                  <ul className="mt-2 space-y-1">
                    <li>
                      Marketplace commission ({Math.round(COMMISSION_RATE * 100)}%):{" "}
                      {formatRands(split.commissionCents)}
                    </li>
                    <li>
                      Seller share held in escrow: {formatRands(split.payoutCents)}, released{" "}
                      {ESCROW_DAYS} days after payment
                    </li>
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
