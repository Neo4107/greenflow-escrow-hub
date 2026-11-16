ALTER TABLE public.sellers
  ADD COLUMN pickup_street_address text,
  ADD COLUMN pickup_suburb text,
  ADD COLUMN pickup_city text,
  ADD COLUMN pickup_postal_code text,
  ADD COLUMN pickup_province text;

ALTER TABLE public.orders
  ADD COLUMN delivery_street_address text,
  ADD COLUMN delivery_suburb text,
  ADD COLUMN delivery_city text,
  ADD COLUMN delivery_postal_code text,
  ADD COLUMN delivery_province text,
  ADD COLUMN courier_quote_reference text;
