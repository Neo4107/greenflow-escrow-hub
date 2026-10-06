CREATE TABLE public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  buyer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewer_name text NOT NULL DEFAULT 'Verified buyer',
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (char_length(comment) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, buyer_user_id)
);
GRANT SELECT ON public.product_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_reviews TO authenticated;
GRANT ALL ON public.product_reviews TO service_role;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read reviews" ON public.product_reviews FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Buyers review items they paid for" ON public.product_reviews FOR INSERT TO authenticated
WITH CHECK (
  buyer_user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.product_id = product_reviews.product_id AND o.buyer_user_id = auth.uid() AND o.status = 'paid'
  )
);
CREATE POLICY "Buyers edit own review" ON public.product_reviews FOR UPDATE TO authenticated USING (buyer_user_id = auth.uid()) WITH CHECK (buyer_user_id = auth.uid());
CREATE POLICY "Buyers delete own review" ON public.product_reviews FOR DELETE TO authenticated USING (buyer_user_id = auth.uid());
CREATE INDEX product_reviews_product_idx ON public.product_reviews(product_id, created_at DESC);