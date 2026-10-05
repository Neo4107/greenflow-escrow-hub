ALTER TABLE public.return_requests
  ADD COLUMN IF NOT EXISTS refund_gateway_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS refund_gateway_reference text,
  ADD COLUMN IF NOT EXISTS refund_processed_at timestamptz;