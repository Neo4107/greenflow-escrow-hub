# Rooted — task roadmap

## Open tasks (waiting on user)
1. **Courier Guy provider ID** (user to supply) → then:
   - Wire The Courier Guy's real delivery rates into checkout (needs shopper address fields at checkout — user must confirm).
   - Auto-update order fulfilment from The Courier Guy tracking (waybill status → dispatched/delivered).
2. **End-to-end real order** (blocked by 1): once provider ID is in, place a real order — listing → checkout → payment → waybill → delivered. Payment step also needs PAYSTACK_SECRET_KEY (not saved yet).
3. **PAYSTACK_SECRET_KEY** (user to supply) → live payments, refunds.
4. **Email sender domain** not configured → approval email, admin alert email.
5. **Admin alert email address** (user to supply).
6. **Real seller + product listings** (user content).
7. One unselected security scan finding — mention, do not fix.

## Done (recent)
- Delivery fee from parcel weight/L×W×H÷5000, sellers enter parcel size per listing.
- Reviews on product pages (verified buyers only, one per item, editable).
- Refund webhook + dispute refund tracking; Fynbos & Clay test data deleted.
- Security findings lov_finding_c32d4554c1571eda, lov_finding_e0baaff47f63086e, lov_finding_e6ae16d118180b1e fixed; js-yaml bumped.
