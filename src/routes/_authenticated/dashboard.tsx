import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Loader2,
  Plus,
  Store,
  XCircle,
} from "lucide-react";

import {
  getMyAccount,
  createStore,
  saveProduct,
  startSubscriptionCheckout,
  confirmSubscriptionPayment,
} from "@/lib/seller.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  ECO_ATTRIBUTES,
  ECO_LABELS,
  PROVINCES,
  formatRands,
  SUBSCRIPTION_FEE_CENTS,
} from "@/lib/eco";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Seller dashboard — Rooted" },
      {
        name: "description",
        content:
          "Manage your Rooted store: listings, product review outcomes and your R240 platform fee balance.",
      },
      { property: "og:title", content: "Seller dashboard — Rooted" },
      {
        property: "og:description",
        content: "Manage listings, review outcomes and your platform fee balance on Rooted.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

const statusStyles: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground", icon: Clock },
  pending_admin_review: {
    label: "Pending review",
    className: "bg-secondary text-secondary-foreground",
    icon: Clock,
  },
  approved: { label: "Approved", className: "bg-primary/15 text-primary", icon: CheckCircle2 },
  rejected: { label: "Rejected", className: "bg-destructive/15 text-destructive", icon: XCircle },
};

function DashboardPage() {
  const queryClient = useQueryClient();
  const fetchAccount = useServerFn(getMyAccount);
  const { data, isLoading } = useQuery({
    queryKey: ["my-account"],
    queryFn: () => fetchAccount(),
  });

  if (isLoading) {
    return (
      <Shell>
        <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
      </Shell>
    );
  }

  if (!data?.store) {
    return (
      <Shell>
        <CreateStoreForm
          onCreated={() => queryClient.invalidateQueries({ queryKey: ["my-account"] })}
        />
      </Shell>
    );
  }

  const { store, products, payments, certificates, ledger } = data;

  return (
    <Shell>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold">{store.store_name}</h1>
          <p className="text-sm text-muted-foreground">{store.tagline ?? "Your Rooted store"}</p>
        </div>
        <Link
          to="/store/$slug"
          params={{ slug: store.slug }}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          <ExternalLink className="h-4 w-4" />
          View public store
        </Link>
      </div>

      <FeeBalanceCard
        store={store}
        payments={payments}
        ledger={ledger}
        outstandingFeeCents={data.outstandingFeeCents}
        showNinetyDayNotice={data.showNinetyDayNotice}
      />

      <ProductsCard products={products} certificates={certificates} />

      <AddProductForm onSaved={() => queryClient.invalidateQueries({ queryKey: ["my-account"] })} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10">{children}</main>
    </div>
  );
}

type Account = Awaited<ReturnType<typeof getMyAccount>>;

function FeeBalanceCard({
  store,
  payments,
  ledger,
  outstandingFeeCents,
  showNinetyDayNotice,
}: {
  store: NonNullable<Account["store"]>;
  payments: Account["payments"];
  ledger: Account["ledger"];
  outstandingFeeCents: number;
  showNinetyDayNotice: boolean;
}) {
  const startCheckout = useServerFn(startSubscriptionCheckout);
  const confirmPayment = useServerFn(confirmSubscriptionPayment);
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);

  // Paystack redirects back with ?reference=... — confirm it immediately so the
  // balance updates without waiting for the webhook to land.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") ?? params.get("trxref");
    if (!reference) return;
    window.history.replaceState({}, "", window.location.pathname);
    void confirmPayment({ data: { reference } })
      .then((result) => {
        if (result.activated) {
          setNotice("Payment received — your platform fee balance has been updated.");
          void queryClient.invalidateQueries();
        } else if (result.reason === "not_successful") {
          setNotice(
            "That payment hasn't completed yet. We'll clear your balance as soon as Paystack confirms it.",
          );
        }
      })
      .catch((error: unknown) =>
        setNotice(error instanceof Error ? error.message : "Could not confirm the payment."),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkout = useMutation({
    mutationFn: () => startCheckout({ data: { returnUrl: `${window.location.origin}/dashboard` } }),
    onSuccess: (result) => {
      if (result.authorizationUrl) window.location.href = result.authorizationUrl;
      else
        setNotice(
          `Payment reference ${result.reference} was recorded, but the payment gateway isn't set up yet. An admin can clear your balance manually.`,
        );
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "Checkout failed."),
  });

  const owing = outstandingFeeCents > 0;

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-xl font-semibold">
            <CreditCard className="h-5 w-5 text-primary" />
            Platform fee balance
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            R0 upfront. {formatRands(SUBSCRIPTION_FEE_CENTS)} per month plus{" "}
            {Number(store.commission_rate)}% commission, deducted from your sales balance.
          </p>
          <p className="mt-3 font-serif text-3xl font-semibold">
            {formatRands(outstandingFeeCents)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                owing ? "bg-secondary text-secondary-foreground" : "bg-primary/15 text-primary"
              }`}
            >
              {owing ? (
                <AlertTriangle className="h-3.5 w-3.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {owing ? "Outstanding balance" : "Nothing outstanding"}
            </span>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              Listings live since {new Date(store.listing_started_at).toLocaleDateString("en-ZA")}
            </span>
          </div>
        </div>
        <button
          onClick={() => checkout.mutate()}
          disabled={checkout.isPending}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {checkout.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {owing
            ? `Pay ${formatRands(outstandingFeeCents)} now`
            : `Prepay ${formatRands(SUBSCRIPTION_FEE_CENTS)}`}
        </button>
      </div>

      {showNinetyDayNotice ? (
        <div className="mt-4 rounded-lg border border-border bg-secondary/60 p-4 text-sm text-secondary-foreground">
          <p className="font-semibold">Action required: outstanding platform fee balance</p>
          <p className="mt-1">
            Your listings have been running for 90 days or more and no sales have been recorded, so
            your account reflects an outstanding balance of {formatRands(outstandingFeeCents)}.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Keep selling as normal:</strong> your listings stay active and the balance is
              deducted automatically from future sales until it's paid off.
            </li>
            <li>
              <strong>Pay out of pocket:</strong> settle it now to keep your future sales earnings
              whole.
            </li>
          </ul>
          <p className="mt-2 text-xs">
            Please keep your store within our marketplace guidelines — listings that break market
            rules are closed by administration.
          </p>
        </div>
      ) : (
        <p className="mt-4 rounded-lg bg-secondary/40 p-3 text-sm text-secondary-foreground">
          Your listings stay active indefinitely unless removed by administration for breaking
          market rules. When you make a sale, the platform fee and commission come off your sales
          balance automatically.
        </p>
      )}
      {notice && <p className="mt-4 text-sm text-muted-foreground">{notice}</p>}

      {ledger.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Entry</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Balance</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((entry) => (
                <tr key={entry.id} className="border-t border-border">
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(entry.created_at).toLocaleDateString("en-ZA")}
                  </td>
                  <td className="px-3 py-2">{entry.description ?? entry.entry_type}</td>
                  <td className="px-3 py-2">
                    {entry.entry_type === "fee_charge" ? "+" : "−"}
                    {formatRands(entry.amount_cents)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {formatRands(entry.balance_after_cents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {payments.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Out-of-pocket payment</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Period</th>
                <th className="px-3 py-2">Reference</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-t border-border">
                  <td className="px-3 py-2">{formatRands(payment.amount_cents)}</td>
                  <td className="px-3 py-2 capitalize">{payment.status}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {payment.period_start} → {payment.period_end}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {payment.gateway_reference}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ProductsCard({
  products,
  certificates,
}: {
  products: Account["products"];
  certificates: Account["certificates"];
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="font-serif text-xl font-semibold">Listings &amp; review outcomes</h2>
      {products.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          No listings yet — add your first eco product below.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {products.map((product) => {
            const style = statusStyles[product.status] ?? statusStyles["draft"]!;
            const StatusIcon = style.icon;
            const certificate = certificates.find((c) => c.product_id === product.id);
            return (
              <li
                key={product.id}
                className="flex flex-col gap-2 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{product.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatRands(product.price_cents)} · {product.stock} in stock
                    {product.is_branded && product.brand_name ? ` · ${product.brand_name}` : ""}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {product.eco_attributes.map((attr) => (
                      <span
                        key={attr}
                        className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground"
                      >
                        {ECO_LABELS[attr] ?? attr}
                      </span>
                    ))}
                  </div>
                  {product.admin_notes && (
                    <p className="mt-2 text-sm text-destructive">
                      Reviewer note: {product.admin_notes}
                    </p>
                  )}
                  {certificate && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Brand certificate: {certificate.status}
                      {certificate.review_notes ? ` — ${certificate.review_notes}` : ""}
                    </p>
                  )}
                </div>
                <span
                  className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${style.className}`}
                >
                  <StatusIcon className="h-3.5 w-3.5" />
                  {style.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function CreateStoreForm({ onCreated }: { onCreated: () => void }) {
  const create = useServerFn(createStore);
  const [form, setForm] = useState({
    storeName: "",
    tagline: "",
    description: "",
    province: "",
    contactEmail: "",
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      create({
        data: {
          storeName: form.storeName,
          tagline: form.tagline || undefined,
          description: form.description || undefined,
          province: form.province || undefined,
          contactEmail: form.contactEmail || undefined,
        },
      }),
    onSuccess: onCreated,
    onError: (e) => setError(e instanceof Error ? e.message : "Could not create your store."),
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h1 className="flex items-center gap-2 font-serif text-2xl font-semibold">
        <Store className="h-6 w-6 text-primary" />
        Create your store
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        No upfront fees — set up your store and list today. The{" "}
        {formatRands(SUBSCRIPTION_FEE_CENTS)} monthly platform fee and 10% commission come off your
        sales balance.
      </p>
      <form
        className="mt-6 grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          mutation.mutate();
        }}
      >
        <Field label="Store name" required>
          <input
            required
            minLength={2}
            value={form.storeName}
            onChange={(e) => setForm({ ...form, storeName: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Province">
          <select
            value={form.province}
            onChange={(e) => setForm({ ...form, province: e.target.value })}
            className={inputClass}
          >
            <option value="">Select…</option>
            {PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tagline">
          <input
            value={form.tagline}
            onChange={(e) => setForm({ ...form, tagline: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="Contact email">
          <input
            type="email"
            value={form.contactEmail}
            onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
            className={inputClass}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="About your store">
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
        {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create store
          </button>
        </div>
      </form>
    </section>
  );
}

function AddProductForm({ onSaved }: { onSaved: () => void }) {
  const save = useServerFn(saveProduct);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    priceRands: "",
    stock: "0",
    imageUrl: "",
    isBranded: false,
    brandName: "",
    certificateExpiryDate: "",
  });
  const [attributes, setAttributes] = useState<string[]>([]);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      let certificateDocumentPath: string | undefined;
      if (form.isBranded) {
        if (!certificateFile) {
          throw new Error(
            "Branded listings require a Certificate of Authorization / Letter of Authority.",
          );
        }
        const { data: user } = await supabase.auth.getUser();
        const path = `${user.user?.id}/${Date.now()}-${certificateFile.name.replace(/[^\w.-]+/g, "_")}`;
        const { error: uploadError } = await supabase.storage
          .from("brand-certificates")
          .upload(path, certificateFile, { upsert: false });
        if (uploadError) throw new Error(uploadError.message);
        certificateDocumentPath = path;
      }

      return save({
        data: {
          title: form.title,
          description: form.description || undefined,
          category: form.category || undefined,
          priceRands: Number(form.priceRands),
          stock: Number(form.stock),
          imageUrl: form.imageUrl || undefined,
          ecoAttributes: attributes,
          isBranded: form.isBranded,
          brandName: form.isBranded ? form.brandName : undefined,
          certificateDocumentPath,
          certificateExpiryDate: form.certificateExpiryDate || undefined,
        },
      });
    },
    onSuccess: (result) => {
      setSuccess(
        result.status === "approved"
          ? "Listed and live on the marketplace."
          : "Submitted for admin review — branded listings need certificate approval first.",
      );
      setForm({
        title: "",
        description: "",
        category: "",
        priceRands: "",
        stock: "0",
        imageUrl: "",
        isBranded: false,
        brandName: "",
        certificateExpiryDate: "",
      });
      setAttributes([]);
      setCertificateFile(null);
      onSaved();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save the product."),
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-serif text-xl font-semibold">Add a product</h2>
        <button
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          <Plus className="h-4 w-4" />
          {open ? "Close" : "New listing"}
        </button>
      </div>

      {open && (
        <form
          className="mt-6 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setSuccess(null);
            if (attributes.length === 0) {
              setError("Pick at least one eco attribute.");
              return;
            }
            mutation.mutate();
          }}
        >
          <Field label="Title" required>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Category">
            <input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Price (ZAR)" required>
            <input
              required
              type="number"
              min="1"
              step="0.01"
              value={form.priceRands}
              onChange={(e) => setForm({ ...form, priceRands: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Stock" required>
            <input
              required
              type="number"
              min="0"
              step="1"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
              className={inputClass}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Image URL">
              <input
                type="url"
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description">
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <p className="text-sm font-medium">Eco attributes</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ECO_ATTRIBUTES.map((attr) => {
                const selected = attributes.includes(attr);
                return (
                  <button
                    key={attr}
                    type="button"
                    onClick={() =>
                      setAttributes(
                        selected ? attributes.filter((a) => a !== attr) : [...attributes, attr],
                      )
                    }
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {ECO_LABELS[attr]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="sm:col-span-2 rounded-xl border border-border p-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.isBranded}
                onChange={(e) => setForm({ ...form, isBranded: e.target.checked })}
              />
              This is a branded product
            </label>
            {form.isBranded && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Brand name" required>
                  <input
                    required
                    value={form.brandName}
                    onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Certificate expiry date">
                  <input
                    type="date"
                    value={form.certificateExpiryDate}
                    onChange={(e) => setForm({ ...form, certificateExpiryDate: e.target.value })}
                    className={inputClass}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Certificate of Authorization / Letter of Authority" required>
                    <input
                      required
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={(e) => setCertificateFile(e.target.files?.[0] ?? null)}
                      className="mt-1 w-full text-sm"
                    />
                  </Field>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Branded listings stay pending until an admin verifies this document.
                  </p>
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
          {success && <p className="text-sm text-primary sm:col-span-2">{success}</p>}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save listing
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

const inputClass =
  "mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      {children}
    </label>
  );
}
