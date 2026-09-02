-- Escrow can now be reversed after a dispute resolution
ALTER TYPE public.payout_status ADD VALUE IF NOT EXISTS 'reversed';

CREATE TYPE public.rma_status AS ENUM (
  'open',
  'ai_retention_offered',
  'awaiting_return',
  'escalated',
  'resolved_refund',
  'resolved_replacement',
  'resolved_credit',
  'rejected'
);

CREATE TYPE public.rma_outcome AS ENUM ('refund', 'replacement', 'store_credit');

CREATE TABLE public.return_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  buyer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  reason text NOT NULL,
  description text,
  requested_outcome public.rma_outcome NOT NULL DEFAULT 'refund',
  item_damaged boolean NOT NULL DEFAULT false,
  item_used boolean NOT NULL DEFAULT false,
  retention_offer text,
  retention_offer_accepted boolean,
  status public.rma_status NOT NULL DEFAULT 'open',
  admin_notes text,
  resolution_summary text,
  refund_amount_cents integer NOT NULL DEFAULT 0,
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.return_requests TO authenticated;
GRANT ALL ON public.return_requests TO service_role;
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage return requests" ON public.return_requests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "buyer opens own return requests" ON public.return_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = buyer_user_id AND EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.buyer_user_id = auth.uid()
  ));

CREATE POLICY "buyer reads own return requests" ON public.return_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = buyer_user_id);

CREATE POLICY "seller reads return requests against own store" ON public.return_requests
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sellers s WHERE s.id = return_requests.seller_id AND s.user_id = auth.uid()
  ));

CREATE INDEX return_requests_status_idx ON public.return_requests(status, created_at DESC);
CREATE INDEX return_requests_seller_idx ON public.return_requests(seller_id);

CREATE TRIGGER return_requests_updated_at
  BEFORE UPDATE ON public.return_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.dispute_evidence (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  return_request_id uuid NOT NULL REFERENCES public.return_requests(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uploader_role public.app_role NOT NULL,
  file_path text NOT NULL,
  file_type text,
  caption text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.dispute_evidence TO authenticated;
GRANT ALL ON public.dispute_evidence TO service_role;
ALTER TABLE public.dispute_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage dispute evidence" ON public.dispute_evidence
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "participants read dispute evidence" ON public.dispute_evidence
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.return_requests r
    WHERE r.id = dispute_evidence.return_request_id
      AND (
        r.buyer_user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = r.seller_id AND s.user_id = auth.uid())
      )
  ));

CREATE POLICY "participants add dispute evidence" ON public.dispute_evidence
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.return_requests r
    WHERE r.id = dispute_evidence.return_request_id
      AND (
        r.buyer_user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = r.seller_id AND s.user_id = auth.uid())
      )
  ));

CREATE INDEX dispute_evidence_request_idx ON public.dispute_evidence(return_request_id, created_at DESC);

-- Private storage for dispute evidence files
CREATE POLICY "dispute evidence admin access" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'dispute-evidence' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'dispute-evidence' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "dispute evidence owner upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dispute-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "dispute evidence owner read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'dispute-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);