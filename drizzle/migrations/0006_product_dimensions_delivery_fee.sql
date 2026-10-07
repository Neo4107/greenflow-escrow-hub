ALTER TABLE public.products
  ADD COLUMN weight_kg numeric(8,3),
  ADD COLUMN length_cm numeric(8,1),
  ADD COLUMN width_cm numeric(8,1),
  ADD COLUMN height_cm numeric(8,1);
ALTER TABLE public.orders ADD COLUMN delivery_cents integer NOT NULL DEFAULT 0;