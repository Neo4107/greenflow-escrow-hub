CREATE TYPE public.fee_entry_type AS ENUM ('fee_charge', 'sales_deduction', 'out_of_pocket_payment', 'write_off');

ALTER TABLE public.sellers
  ADD COLUMN outstanding_fee_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN listing_started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN fees_charged_through date,
  ADD COLUMN fee_notice_90d_sent_at timestamptz;

ALTER TABLE public.seller_payouts
  ADD COLUMN fee_deducted_cents integer NOT NULL DEFAULT 0;

CREATE TABLE public.platform_fee_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  entry_type public.fee_entry_type NOT NULL,
  amount_cents integer NOT NULL,
  balance_after_cents integer NOT NULL DEFAULT 0,
  description text,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  payout_id uuid REFERENCES public.seller_payouts(id) ON DELETE SET NULL,
  subscription_payment_id uuid REFERENCES public.subscription_payments(id) ON DELETE SET NULL,
  period_start date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX platform_fee_ledger_seller_idx ON public.platform_fee_ledger (seller_id, created_at DESC);
CREATE UNIQUE INDEX platform_fee_ledger_monthly_charge_idx
  ON public.platform_fee_ledger (seller_id, period_start)
  WHERE entry_type = 'fee_charge';

GRANT SELECT ON public.platform_fee_ledger TO authenticated;
GRANT ALL ON public.platform_fee_ledger TO service_role;

ALTER TABLE public.platform_fee_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seller reads own fee ledger" ON public.platform_fee_ledger
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = platform_fee_ledger.seller_id AND s.user_id = auth.uid()));

CREATE POLICY "admins manage fee ledger" ON public.platform_fee_ledger
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER platform_fee_ledger_updated_at
  BEFORE UPDATE ON public.platform_fee_ledger
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY "public sees active stores" ON public.sellers;
CREATE POLICY "public sees stores" ON public.sellers
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY "public sees approved products of paid sellers" ON public.products;
CREATE POLICY "public sees approved products" ON public.products
  FOR SELECT TO anon, authenticated
  USING (status = 'approved');

UPDATE public.sellers SET is_active_subscription = true WHERE is_active_subscription = false;
