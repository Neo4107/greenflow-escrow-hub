CREATE OR REPLACE FUNCTION public.guard_seller_approval()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.approval_status := 'pending'; NEW.approved_at := NULL; NEW.approval_notes := NULL;
      NEW.outstanding_fee_cents := 0;
      NEW.fees_charged_through := NULL;
      NEW.fee_notice_90d_sent_at := NULL;
      NEW.listing_started_at := now();
    ELSE
      IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
         OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
         OR NEW.approval_notes IS DISTINCT FROM OLD.approval_notes THEN
        RAISE EXCEPTION 'Only admins can change store approval';
      END IF;
      IF NEW.outstanding_fee_cents IS DISTINCT FROM OLD.outstanding_fee_cents
         OR NEW.fees_charged_through IS DISTINCT FROM OLD.fees_charged_through
         OR NEW.fee_notice_90d_sent_at IS DISTINCT FROM OLD.fee_notice_90d_sent_at
         OR NEW.listing_started_at IS DISTINCT FROM OLD.listing_started_at
         OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
         OR NEW.subscription_fee_cents IS DISTINCT FROM OLD.subscription_fee_cents
         OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
         OR NEW.is_active_subscription IS DISTINCT FROM OLD.is_active_subscription
         OR NEW.next_billing_date IS DISTINCT FROM OLD.next_billing_date
         OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
        RAISE EXCEPTION 'Only the platform can change billing fields';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $function$;