import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Store } from "lucide-react";

import { listStores } from "@/lib/marketplace.functions";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/stores/")({
  head: () => ({
    meta: [
      { title: "Eco stores — verified South African makers | Rooted" },
      {
        name: "description",
        content:
          "Browse every verified eco store on Rooted. Independent South African makers with active subscriptions, listing zero-waste, vegan and organic products.",
      },
      { property: "og:title", content: "Eco stores — verified South African makers | Rooted" },
      {
        property: "og:description",
        content: "Browse verified eco stores from independent South African makers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StoresPage,
});

function StoresPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["stores"],
    queryFn: () => listStores(),
  });

  const stores = data?.stores ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="font-serif text-3xl font-semibold md:text-4xl">Verified eco stores</h1>
        <p className="mt-2 max-w-lg text-muted-foreground">
          Every store here has an active R240/month subscription and products reviewed by our team.
        </p>

        {isLoading ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
            ))}
          </div>
        ) : stores.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card/50 py-20 text-center">
            <Store className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-3 font-serif text-xl font-semibold">No active stores yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Stores appear once a seller's subscription is active.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((store) => (
              <Link
                key={store.id}
                to="/store/$slug"
                params={{ slug: store.slug }}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  {store.logo_url ? (
                    <img
                      src={store.logo_url}
                      alt={`${store.store_name} logo`}
                      loading="lazy"
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                      <Store className="h-5 w-5" />
                    </span>
                  )}
                  <div>
                    <h2 className="font-serif text-lg font-semibold">{store.store_name}</h2>
                    {store.province && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {store.province}
                      </p>
                    )}
                  </div>
                </div>
                {store.tagline && (
                  <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{store.tagline}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
