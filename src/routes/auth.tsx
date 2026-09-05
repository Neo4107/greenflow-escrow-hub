import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Leaf, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

type Intent = "buyer" | "seller";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { intent: Intent } => ({
    intent: search.intent === "seller" ? "seller" : "buyer",
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Rooted eco marketplace" },
      {
        name: "description",
        content:
          "Sign in or create a free Rooted account to buy South African eco-friendly products, track orders and open return tickets — or start a seller store.",
      },
      { property: "og:title", content: "Sign in — Rooted eco marketplace" },
      {
        property: "og:description",
        content:
          "Create a free Rooted shopper account to buy eco-friendly products, follow your orders and open return tickets.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { intent } = Route.useSearch();
  const isSeller = intent === "seller";
  const landing = isSeller ? "/dashboard" : "/account";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: landing, replace: true });
    });
  }, [navigate, landing]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}${landing}`,
          },
        });
        if (signUpError) throw signUpError;
        const { data: session } = await supabase.auth.getSession();
        if (session.session) navigate({ to: landing });
        else setMessage("Check your inbox to confirm your email, then sign in.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        navigate({ to: landing });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <Link to="/" className="mb-6 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Leaf className="h-5 w-5" />
          </span>
          <span className="font-serif text-2xl font-semibold tracking-tight">Rooted</span>
        </Link>
        <h1 className="font-serif text-2xl font-semibold">
          {mode === "signin"
            ? "Welcome back"
            : isSeller
              ? "Create your seller account"
              : "Create your shopper account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isSeller
            ? "Flat R240/month subscription · 10% commission on sales."
            : "Free to join · track your orders and open a return ticket any time."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div>
              <label htmlFor="fullName" className="text-sm font-medium">
                Full name
              </label>
              <input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {message && <p className="text-sm text-primary">{message}</p>}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "New to Rooted?" : "Already have an account?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setMessage(null);
            }}
            className="font-medium text-primary hover:underline"
          >
            {mode === "signin"
              ? isSeller
                ? "Create a seller account"
                : "Create a shopper account"
              : "Sign in"}
          </button>
        </p>

        <p className="mt-3 text-center text-sm text-muted-foreground">
          {isSeller ? (
            <Link to="/auth" search={{ intent: "buyer" }} className="hover:underline">
              I just want to shop
            </Link>
          ) : (
            <Link to="/auth" search={{ intent: "seller" }} className="hover:underline">
              I want to sell on Rooted
            </Link>
          )}
        </p>
      </div>
    </main>
  );
}
