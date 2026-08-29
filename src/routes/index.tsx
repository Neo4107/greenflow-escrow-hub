import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Leaf, Search, Store, Sprout, ShieldCheck, PackageSearch } from "lucide-react";

import { listProducts } from "@/lib/marketplace.functions";
import { ECO_ATTRIBUTES, ECO_LABELS, formatRands } from "@/lib/eco";
import heroImage from "@/assets/hero-eco-market.jpg";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const [search, setSearch] = useState("");
  const [attribute, setAttribute] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["marketplace-products", search, attribute],
    queryFn: () =>
      listProducts({
        data: {
          search: search.trim() || undefined,
          attribute: attribute ?? undefined,
        },
      }),
  });

  const products = data?.products ?? [];
  const stores = data?.stores ?? {};

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Leaf className="h-5 w-5" />
            </span>
            <span className="font-serif text-2xl font-semibold tracking-tight">Rooted</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium">
            <a href="#shop" className="text-muted-foreground transition-colors hover:text-foreground">
              Shop
            </a>
            <a
              href="#sell"
              className="rounded-full bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Sell on Rooted
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <img
          src={heroImage}
          alt="Handcrafted eco-friendly products from South African makers"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-background/20" />
        <div className="relative mx-auto max-w-6xl px-4 py-24 md:py-32">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Sprout className="h-3.5 w-3.5 text-primary" />
            Verified eco-friendly · Made in South Africa
          </p>
          <h1 className="max-w-xl font-serif text-4xl font-semibold leading-tight md:text-6xl">
            Good for the earth. Good for local makers.
          </h1>
          <p className="mt-4 max-w-md text-lg text-muted-foreground">
            Discover zero-waste, vegan and organic products from independent South African stores —
            every seller verified, every brand certified.
          </p>
          <a
            href="#shop"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Search className="h-4 w-4" />
            Browse the marketplace
          </a>
        </div>
      </section>

      {/* Search + filters + grid */}
      <section id="shop" className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-6 flex flex-col gap-4">
          <div className="relative max-w-xl">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search eco-friendly products…"
              className="w-full rounded-full border border-input bg-card py-3 pl-11 pr-4 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30"
              aria-label="Search products"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setAttribute(null)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                attribute === null
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              All
            </button>
            {ECO_ATTRIBUTES.map((attr) => (
              <button
                key={attr}
                onClick={() => setAttribute(attribute === attr ? null : attr)}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  attribute === attr
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {ECO_LABELS[attr]}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-border bg-card">
                <div className="aspect-square bg-muted" />
                <div className="space-y-2 p-4">
                  <div className="h-4 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 py-20 text-center">
            <PackageSearch className="h-10 w-10 text-muted-foreground" />
            <h2 className="font-serif text-xl font-semibold">No products found</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              {search || attribute
                ? "Try a different search term or clear the eco filters."
                : "Approved products from verified sellers will appear here soon."}
            </p>
            {(search || attribute) && (
              <button
                onClick={() => {
                  setSearch("");
                  setAttribute(null);
                }}
                className="mt-2 rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <article
                key={product.id}
                className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="relative aspect-square overflow-hidden bg-muted">
                  {product.images[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Leaf className="h-10 w-10 text-muted-foreground/50" />
                    </div>
                  )}
                  {product.stock === 0 && (
                    <span className="absolute left-3 top-3 rounded-full bg-foreground/85 px-2.5 py-1 text-xs font-semibold text-background">
                      Sold out
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="line-clamp-1 font-medium">{product.title}</h3>
                  {stores[product.seller_id] && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Store className="h-3 w-3" />
                      {stores[product.seller_id]}
                    </p>
                  )}
                  {product.eco_attributes.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {product.eco_attributes.slice(0, 2).map((attr) => (
                        <span
                          key={attr}
                          className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground"
                        >
                          {ECO_LABELS[attr] ?? attr}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="mt-3 font-serif text-lg font-semibold text-primary">
                    {formatRands(product.price_cents)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Trust strip */}
      <section className="border-t border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: "Certified brands",
              text: "Branded products require verified certificates reviewed by our team before listing.",
            },
            {
              icon: Store,
              title: "Independent sellers",
              text: "Every store is a South African maker paying a flat R240/month — no hidden fees.",
            },
            {
              icon: Sprout,
              title: "Genuinely eco",
              text: "Filter by real attributes: zero-waste, vegan, biodegradable, locally made and more.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-serif text-lg font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground md:flex-row">
          <p className="flex items-center gap-2">
            <Leaf className="h-4 w-4 text-primary" />
            Rooted — South Africa's eco-friendly marketplace
          </p>
          <p>10% commission · R240/month seller subscription</p>
        </div>
      </footer>
    </div>
  );
}
