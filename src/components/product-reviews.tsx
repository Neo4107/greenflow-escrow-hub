import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

function Stars({ value, onPick }: { value: number; onPick?: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onPick}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onClick={() => onPick?.(n)}
          className={onPick ? "cursor-pointer" : "cursor-default"}
        >
          <Star className={`h-5 w-5 ${n <= value ? "fill-primary text-primary" : "text-muted-foreground"}`} />
        </button>
      ))}
    </div>
  );
}

export function ProductReviews({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: reviews = [] } = useQuery({
    queryKey: ["reviews", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_reviews")
        .select("id, buyer_user_id, reviewer_name, rating, comment, created_at")
        .eq("product_id", productId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const mine = reviews.find((r) => r.buyer_user_id === userId);
  useEffect(() => {
    if (mine) {
      setRating(mine.rating);
      setComment(mine.comment ?? "");
    }
  }, [mine?.id]);

  const average = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  async function submit() {
    if (!userId || rating < 1) return toast.error("Pick a star rating first.");
    setBusy(true);
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle();
    const name = profile?.full_name?.trim().split(/\s+/)[0] || "Verified buyer";
    const { error } = await supabase.from("product_reviews").upsert(
      { product_id: productId, buyer_user_id: userId, rating, comment: comment.trim() || null, reviewer_name: name },
      { onConflict: "product_id,buyer_user_id" },
    );
    setBusy(false);
    if (error) {
      toast.error(
        error.code === "42501" ? "Only shoppers who have paid for this item can review it." : error.message,
      );
      return;
    }
    toast.success("Thanks for your review!");
    void qc.invalidateQueries({ queryKey: ["reviews", productId] });
  }

  return (
    <section className="mt-14 space-y-6 border-t border-border pt-10">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="font-serif text-2xl">Reviews</h2>
        {reviews.length ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Stars value={Math.round(average)} /> {average.toFixed(1)} from {reviews.length} review
            {reviews.length > 1 ? "s" : ""}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        {userId ? (
          <div className="space-y-3">
            <p className="font-medium">{mine ? "Update your review" : "Bought this? Leave a review"}</p>
            <Stars value={rating} onPick={setRating} />
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 1000))}
              rows={3}
              placeholder="How was the quality, packaging and delivery?"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <Button onClick={submit} disabled={busy}>
              {mine ? "Update review" : "Post review"}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            <Link to="/auth" className="text-primary underline">Sign in</Link> to review an item you've bought.
          </p>
        )}
      </div>

      {reviews.length === 0 ? (
        <p className="text-muted-foreground">No reviews yet.</p>
      ) : (
        <ul className="space-y-4">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <Stars value={r.rating} />
                <span className="text-xs text-muted-foreground">
                  {r.reviewer_name} · Verified buyer · {new Date(r.created_at).toLocaleDateString("en-ZA")}
                </span>
              </div>
              {r.comment ? <p className="mt-2 text-sm">{r.comment}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
