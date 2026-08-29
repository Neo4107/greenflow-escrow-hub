import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Leaf } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export function SiteHeader() {
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setEmail(data.session?.user.email ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Leaf className="h-5 w-5" />
          </span>
          <span className="font-serif text-2xl font-semibold tracking-tight">Rooted</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link to="/" className="text-muted-foreground transition-colors hover:text-foreground">
            Shop
          </Link>
          <Link
            to="/stores"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Stores
          </Link>
          {ready && email ? (
            <>
              <Link
                to="/dashboard"
                className="rounded-full bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Seller dashboard
              </Link>
              <button
                onClick={handleSignOut}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="rounded-full bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Sell on Rooted
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
