CREATE TYPE public.order_status AS ENUM ('pending','paid','failed','cancelled','refunded');
CREATE TYPE public.payout_status AS ENUM ('escrow','releasable','paid','withheld','refunded');

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  buyer_email text NOT NULL,
  subtotal_cents integer NOT NULL,
  commission_cents integer NOT NULL,
  payout_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'ZAR',
  commission_rate numeric NOT NULL DEFAULT 10.00,
  status public.order_status NOT NULL DEFAULT 'pending',
  gateway text NOT NULL DEFAULT 'paystack',
  gateway_reference text NOT NULL UNIQUE,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  seller_id uuid NOT NULL REFERENCES public.sellers(id),
  title text NOT NULL,
  unit_price_cents integer NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  subtotal_cents integer NOT NULL,
  commission_cents integer NOT NULL,
  payout_cents integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.seller_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES public.sellers(id),
  gross_cents integer NOT NULL,
  commission_cents integer NOT NULL,
  amount_cents integer NOT NULL,
  escrow_release_at timestamptz NOT NULL,
  status public.payout_status NOT NULL DEFAULT 'escrow',
  released_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, seller_id)
);

CREATE INDEX orders_buyer_idx ON public.orders(buyer_user_id);
CREATE INDEX order_items_seller_idx ON public.order_items(seller_id);
CREATE INDEX seller_payouts_release_idx ON public.seller_payouts(status, escrow_release_at);

GRANT SELECT, INSERT ON public.orders TO authenticated;
GRANT SELECT ON public.order_items TO authenticated;
GRANT SELECT ON public.seller_payouts TO authenticated;
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.order_items TO service_role;
GRANT ALL ON public.seller_payouts TO service_role;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "buyer reads own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = buyer_user_id);
CREATE POLICY "buyer creates own orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_user_id);
CREATE POLICY "admins manage orders" ON public.orders FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "buyer reads own order items" ON public.order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.buyer_user_id = auth.uid()));
CREATE POLICY "seller reads own order items" ON public.order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = order_items.seller_id AND s.user_id = auth.uid()));
CREATE POLICY "admins manage order items" ON public.order_items FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "seller reads own payouts" ON public.seller_payouts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = seller_payouts.seller_id AND s.user_id = auth.uid()));
CREATE POLICY "admins manage payouts" ON public.seller_payouts FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER seller_payouts_updated_at BEFORE UPDATE ON public.seller_payouts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();