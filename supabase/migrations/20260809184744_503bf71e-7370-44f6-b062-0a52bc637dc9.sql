-- 1. Integrity: composite uniqueness on rent_records + composite FK from rent_payments
ALTER TABLE public.rent_records
  ADD CONSTRAINT rent_records_id_building_flat_tenant_key
  UNIQUE (id, building_id, flat_id, tenant_id);

ALTER TABLE public.rent_payments
  ADD CONSTRAINT rent_payments_record_scope_fkey
  FOREIGN KEY (rent_record_id, building_id, flat_id, tenant_id)
  REFERENCES public.rent_records (id, building_id, flat_id, tenant_id)
  ON UPDATE CASCADE ON DELETE CASCADE;

-- 2. Replace the tautological tenant INSERT policy
DROP POLICY IF EXISTS "Tenants can submit own payments" ON public.rent_payments;

CREATE POLICY "Tenants can submit own payments"
ON public.rent_payments
FOR INSERT
TO authenticated
WITH CHECK (
  rent_payments.tenant_id = auth.uid()
  AND rent_payments.verification_status = 'pending'::public.verification_status
  AND rent_payments.payment_method <> 'cash'::public.payment_method
  AND rent_payments.verified_by IS NULL
  AND rent_payments.verified_at IS NULL
  AND rent_payments.amount_paid > 0
  AND EXISTS (
    SELECT 1
    FROM public.rent_records rr
    JOIN public.flats f ON f.id = rr.flat_id
    WHERE rr.id = rent_payments.rent_record_id
      AND rr.building_id = rent_payments.building_id
      AND rr.flat_id = rent_payments.flat_id
      AND rr.tenant_id = rent_payments.tenant_id
      AND rr.tenant_id = auth.uid()
      AND f.building_id = rr.building_id
      AND f.tenant_id = auth.uid()
      AND rr.remaining_due > 0
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.rent_payments existing
    WHERE existing.rent_record_id = rent_payments.rent_record_id
      AND existing.verification_status = 'pending'::public.verification_status
  )
);

-- 3. Harden search_path on all definer/helper functions
ALTER FUNCTION public.has_role(uuid, public.app_role) SET search_path = public, pg_temp;
ALTER FUNCTION public.can_view_building(uuid, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.can_review_building(uuid, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.can_review_tenant(uuid, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.allocate_shared_charge(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.review_rent_payment(uuid, text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.review_bill_adjustment(uuid, text, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.withdraw_rent_payment(uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.recalc_rent_record_totals(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.charges_block_when_paid() SET search_path = public, pg_temp;
ALTER FUNCTION public.charges_sync_totals() SET search_path = public, pg_temp;
ALTER FUNCTION public.rent_records_set_remaining() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.prevent_role_change() SET search_path = public, pg_temp;

-- 4. Internal-only helpers: no direct callers
REVOKE ALL ON FUNCTION public.recalc_rent_record_totals(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.charges_block_when_paid() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.charges_sync_totals() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rent_records_set_remaining() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_role_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_rent_record_totals(uuid) TO service_role;

-- 5. RLS helper functions: keep EXECUTE for authenticated (required for policy
-- evaluation by the calling role), drop anon/PUBLIC.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_view_building(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_review_building(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_review_tenant(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_building(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_review_building(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_review_tenant(uuid, uuid) TO authenticated, service_role;

-- 6. Intentional RPCs: authenticated + service_role only
REVOKE ALL ON FUNCTION public.allocate_shared_charge(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_rent_payment(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_bill_adjustment(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.withdraw_rent_payment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.allocate_shared_charge(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.review_rent_payment(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.review_bill_adjustment(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.withdraw_rent_payment(uuid, text) TO authenticated, service_role;