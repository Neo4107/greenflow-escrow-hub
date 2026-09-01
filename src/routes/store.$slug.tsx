import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Leaf, MapPin, PackageSearch, Store } from "lucide-react";

import { getStoreBySlug } from "@/lib/marketplace.functions";
import { ECO_LABELS, formatRands } from "@/lib/eco";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/store/$slug")({
  head: ({ params }) => {
    const name = params.slug.replace(/-/g, " ");
    const title = `${name} — eco store on Rooted`;
    const description = `Shop approved eco-friendly products from ${name}, a verified South African maker on Rooted.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: StorePage,
});

function StorePage() {
  const { slug } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["store", slug],
    queryFn: () => getStoreBySlug({ data: { slug } }),
  });

  const store = data?.store ?? null;
  const products = data?.products ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        {isLoading ? (
          <div className="h-32 animate-pulse rounded-2xl border border-border bg-card" />
        ) : !store ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 py-20 text-center">
            <Store className="mx-auto h-10 w-10 text-muted-foreground" />
            <h1 className="mt-3 font-serif text-2xl font-semibold">Store unavailable</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              This store either doesn't exist or its subscription isn't active right now.
            </p>
            <Link
              to="/stores"
              className="mt-6 inline-flex rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Browse all stores
            </Link>
          </div>
        ) : (
          <>
            <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 md:flex-row md:items-center">
              {store.logo_url ? (
                <img
                  src={store.logo_url}
                  alt={`${store.store_name} logo`}
                  className="h-20 w-20 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  <Store className="h-8 w-8" />
                </span>
              )}
              <div>
                <h1 className="font-serif text-3xl font-semibold">{store.store_name}</h1>
                {store.tagline && <p className="mt-1 text-muted-foreground">{store.tagline}</p>}
                {store.province && (
                  <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {store.province}
                  </p>
                )}
              </div>
            </header>

            {store.description && (
              <p className="mt-6 max-w-3xl whitespace-pre-line text-muted-foreground">
                {store.description}
              </p>
            )}

            <h2 className="mt-10 font-serif text-2xl font-semibold">Products</h2>
            {products.length === 0 ? (
              <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
                <PackageSearch className="h-9 w-9 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No approved products listed yet — check back soon.
                </p>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
                      <Link
                    to="/product/$slug"
                    params={{ slug: product.slug }}
                    className="line-clamp-1 block font-medium hover:text-primary"
                  >
                    {product.title}
                  </Link>
                      {product.eco_attributes.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {product.eco_attributes.map((attr) => (
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
          </>
        )}
      </main>
    </div>
  );
}
