CREATE TYPE public.fulfilment_status AS ENUM ('awaiting_packing','packed','dispatched','delivered');
ALTER TABLE public.order_items
  ADD COLUMN fulfilment_status public.fulfilment_status NOT NULL DEFAULT 'awaiting_packing',
  ADD COLUMN courier_name text NOT NULL DEFAULT 'The Courier Guy',
  ADD COLUMN courier_waybill text,
  ADD COLUMN packed_at timestamptz,
  ADD COLUMN dispatched_at timestamptz,
  ADD COLUMN delivered_at timestamptz;