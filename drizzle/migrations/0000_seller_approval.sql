CREATE TYPE public.seller_approval_status AS ENUM ('pending','approved','rejected');
ALTER TABLE public.sellers
  ADD COLUMN approval_status public.seller_approval_status NOT NULL DEFAULT 'pending',
  ADD COLUMN approval_notes text,
  ADD COLUMN approved_at timestamptz;
UPDATE public.sellers SET approval_status = 'approved', approved_at = now();

DROP POLICY "public sees stores" ON public.sellers;
CREATE POLICY "public sees approved stores" ON public.sellers FOR SELECT TO anon, authenticated
  USING (approval_status = 'approved');

DROP POLICY "public sees approved products" ON public.products;
CREATE POLICY "public sees approved products" ON public.products FOR SELECT TO anon, authenticated
  USING (status = 'approved' AND EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = seller_id AND s.approval_status = 'approved'));

DROP POLICY "seller writes own products" ON public.products;
CREATE POLICY "seller writes own products" ON public.products FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.sellers s WHERE s.id = seller_id AND s.user_id = auth.uid() AND s.approval_status = 'approved'));

-- Sellers must not self-approve
CREATE OR REPLACE FUNCTION public.guard_seller_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.approval_status := 'pending'; NEW.approved_at := NULL; NEW.approval_notes := NULL;
    ELSIF NEW.approval_status IS DISTINCT FROM OLD.approval_status
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.approval_notes IS DISTINCT FROM OLD.approval_notes THEN
      RAISE EXCEPTION 'Only admins can change store approval';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER sellers_guard_approval BEFORE INSERT OR UPDATE ON public.sellers
  FOR EACH ROW EXECUTE FUNCTION public.guard_seller_approval();