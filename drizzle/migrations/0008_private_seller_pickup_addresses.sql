CREATE TABLE public.seller_pickup_addresses (
  seller_id uuid PRIMARY KEY REFERENCES public.sellers(id) ON DELETE CASCADE,
  street_address text NOT NULL,
  suburb text NOT NULL,
  city text NOT NULL,
  postal_code text NOT NULL,
  province text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.seller_pickup_addresses TO authenticated;
GRANT ALL ON public.seller_pickup_addresses TO service_role;

ALTER TABLE public.seller_pickup_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seller manages own pickup address" ON public.seller_pickup_addresses
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sellers s
    WHERE s.id = seller_pickup_addresses.seller_id AND s.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sellers s
    WHERE s.id = seller_pickup_addresses.seller_id AND s.user_id = auth.uid()
  ));

CREATE POLICY "admins manage seller pickup addresses" ON public.seller_pickup_addresses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER seller_pickup_addresses_updated_at
  BEFORE UPDATE ON public.seller_pickup_addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON COLUMN public.sellers.pickup_street_address IS 'DEPRECATED: private pickup details now live in seller_pickup_addresses';
COMMENT ON COLUMN public.sellers.pickup_suburb IS 'DEPRECATED: private pickup details now live in seller_pickup_addresses';
COMMENT ON COLUMN public.sellers.pickup_city IS 'DEPRECATED: private pickup details now live in seller_pickup_addresses';
COMMENT ON COLUMN public.sellers.pickup_postal_code IS 'DEPRECATED: private pickup details now live in seller_pickup_addresses';
COMMENT ON COLUMN public.sellers.pickup_province IS 'DEPRECATED: private pickup details now live in seller_pickup_addresses';