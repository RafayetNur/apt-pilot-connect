-- 1. Enums
CREATE TYPE public.payment_method AS ENUM ('bkash', 'nagad', 'bank_transfer', 'cash');
CREATE TYPE public.verification_status AS ENUM ('pending', 'verified', 'rejected', 'correction_requested');
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'partially_paid';

-- 2. rent_records extra columns
ALTER TABLE public.rent_records
  ADD COLUMN IF NOT EXISTS total_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_due numeric NOT NULL DEFAULT 0;

UPDATE public.rent_records SET remaining_due = GREATEST(base_rent - total_paid, 0);

CREATE OR REPLACE FUNCTION public.rent_records_set_remaining()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.total_paid < 0 THEN NEW.total_paid := 0; END IF;
  NEW.remaining_due := GREATEST(NEW.base_rent - NEW.total_paid, 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rent_records_remaining ON public.rent_records;
CREATE TRIGGER rent_records_remaining
BEFORE INSERT OR UPDATE ON public.rent_records
FOR EACH ROW EXECUTE FUNCTION public.rent_records_set_remaining();

-- 3. Reviewer helpers
CREATE OR REPLACE FUNCTION public.can_review_building(building_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.buildings b
    WHERE b.id = building_uuid AND b.owner_id = user_uuid
      AND public.has_role(user_uuid, 'owner'::public.app_role)
  )
  OR EXISTS (
    SELECT 1
    FROM public.buildings b
    JOIN public.profiles p ON p.id = user_uuid
    WHERE b.id = building_uuid
      AND p.role = 'manager'::public.app_role
      AND btrim(b.assigned_manager) <> ''
      AND (
        lower(btrim(b.assigned_manager)) = lower(btrim(p.email))
        OR lower(btrim(b.assigned_manager)) = lower(btrim(p.full_name))
      )
  )
$$;

REVOKE ALL ON FUNCTION public.can_review_building(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_review_building(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_review_tenant(tenant_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.flats f
    WHERE f.tenant_id = tenant_uuid
      AND public.can_review_building(f.building_id, user_uuid)
  )
$$;

REVOKE ALL ON FUNCTION public.can_review_tenant(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_review_tenant(uuid, uuid) TO authenticated, service_role;

-- 4. rent_payments
CREATE TABLE public.rent_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rent_record_id uuid NOT NULL REFERENCES public.rent_records(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  flat_id uuid NOT NULL REFERENCES public.flats(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_paid numeric NOT NULL CHECK (amount_paid > 0),
  payment_method public.payment_method NOT NULL,
  provider_name text,
  transaction_reference text,
  payment_proof_url text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  verification_status public.verification_status NOT NULL DEFAULT 'pending',
  verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at timestamptz,
  reviewer_note text,
  applied_amount numeric NOT NULL DEFAULT 0,
  credit_amount numeric NOT NULL DEFAULT 0,
  receipt_number text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rent_payments_digital_requires_details CHECK (
    payment_method = 'cash'
    OR (
      coalesce(btrim(provider_name), '') <> ''
      AND coalesce(btrim(transaction_reference), '') <> ''
    )
  )
);

CREATE UNIQUE INDEX rent_payments_one_pending_per_record
  ON public.rent_payments (rent_record_id)
  WHERE verification_status = 'pending';

CREATE INDEX rent_payments_tenant_idx ON public.rent_payments (tenant_id);
CREATE INDEX rent_payments_building_idx ON public.rent_payments (building_id);

GRANT SELECT, INSERT, DELETE ON public.rent_payments TO authenticated;
GRANT ALL ON public.rent_payments TO service_role;

ALTER TABLE public.rent_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view own payments"
ON public.rent_payments FOR SELECT TO authenticated
USING (tenant_id = auth.uid());

CREATE POLICY "Reviewers can view building payments"
ON public.rent_payments FOR SELECT TO authenticated
USING (public.can_review_building(building_id, auth.uid()));

CREATE POLICY "Tenants can submit own payments"
ON public.rent_payments FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = auth.uid()
  AND verification_status = 'pending'
  AND payment_method <> 'cash'
  AND verified_by IS NULL
  AND verified_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.rent_records r
    WHERE r.id = rent_record_id AND r.tenant_id = auth.uid()
      AND r.flat_id = flat_id AND r.building_id = building_id
  )
);

CREATE POLICY "Reviewers can record payments"
ON public.rent_payments FOR INSERT TO authenticated
WITH CHECK (
  public.can_review_building(building_id, auth.uid())
  AND verification_status = 'pending'
  AND verified_by IS NULL
  AND verified_at IS NULL
);

CREATE POLICY "Reviewers can delete unverified payments"
ON public.rent_payments FOR DELETE TO authenticated
USING (
  public.can_review_building(building_id, auth.uid())
  AND verification_status <> 'verified'
);

CREATE TRIGGER rent_payments_updated_at
BEFORE UPDATE ON public.rent_payments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. tenant_credits
CREATE TABLE public.tenant_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  flat_id uuid NOT NULL REFERENCES public.flats(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  source_payment_id uuid REFERENCES public.rent_payments(id) ON DELETE SET NULL,
  remaining_amount numeric NOT NULL DEFAULT 0 CHECK (remaining_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tenant_credits TO authenticated;
GRANT ALL ON public.tenant_credits TO service_role;

ALTER TABLE public.tenant_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view own credits"
ON public.tenant_credits FOR SELECT TO authenticated
USING (tenant_id = auth.uid());

CREATE POLICY "Reviewers can view building credits"
ON public.tenant_credits FOR SELECT TO authenticated
USING (public.can_review_building(building_id, auth.uid()));

CREATE TRIGGER tenant_credits_updated_at
BEFORE UPDATE ON public.tenant_credits
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Receipt numbers
CREATE SEQUENCE public.receipt_number_seq;
REVOKE ALL ON SEQUENCE public.receipt_number_seq FROM PUBLIC;
GRANT USAGE ON SEQUENCE public.receipt_number_seq TO service_role;

-- 7. Atomic review action
CREATE OR REPLACE FUNCTION public.review_rent_payment(
  _payment_id uuid,
  _action text,
  _note text DEFAULT NULL
)
RETURNS public.rent_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pay public.rent_payments;
  rec public.rent_records;
  remaining numeric;
  applied numeric;
  excess numeric;
  new_total numeric;
  new_remaining numeric;
  new_status public.payment_status;
  reviewer uuid := auth.uid();
BEGIN
  IF reviewer IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.';
  END IF;

  SELECT * INTO pay FROM public.rent_payments WHERE id = _payment_id FOR UPDATE;
  IF pay.id IS NULL THEN
    RAISE EXCEPTION 'Payment not found.';
  END IF;

  IF NOT public.can_review_building(pay.building_id, reviewer) THEN
    RAISE EXCEPTION 'You are not allowed to review payments for this building.';
  END IF;

  IF pay.verification_status = 'verified' THEN
    RAISE EXCEPTION 'This payment is already verified.';
  END IF;

  IF _action IN ('reject', 'correction_requested')
     AND coalesce(btrim(_note), '') = '' THEN
    RAISE EXCEPTION 'A reviewer note is required for this action.';
  END IF;

  IF _action = 'reject' THEN
    UPDATE public.rent_payments
      SET verification_status = 'rejected',
          reviewer_note = _note,
          verified_by = reviewer,
          verified_at = now()
      WHERE id = _payment_id
      RETURNING * INTO pay;
    RETURN pay;
  ELSIF _action = 'correction_requested' THEN
    UPDATE public.rent_payments
      SET verification_status = 'correction_requested',
          reviewer_note = _note,
          verified_by = reviewer,
          verified_at = now()
      WHERE id = _payment_id
      RETURNING * INTO pay;
    RETURN pay;
  ELSIF _action <> 'verify' THEN
    RAISE EXCEPTION 'Unknown review action.';
  END IF;

  SELECT * INTO rec FROM public.rent_records WHERE id = pay.rent_record_id FOR UPDATE;
  IF rec.id IS NULL THEN
    RAISE EXCEPTION 'Rent record not found.';
  END IF;

  remaining := GREATEST(rec.base_rent - GREATEST(rec.total_paid, 0), 0);
  applied := LEAST(pay.amount_paid, remaining);
  excess := pay.amount_paid - applied;
  new_total := GREATEST(rec.total_paid, 0) + applied;
  new_remaining := GREATEST(rec.base_rent - new_total, 0);

  IF new_remaining = 0 THEN
    new_status := 'paid'::public.payment_status;
  ELSIF new_total > 0 THEN
    new_status := 'partially_paid'::public.payment_status;
  ELSE
    new_status := rec.payment_status;
  END IF;

  UPDATE public.rent_records
    SET total_paid = new_total,
        remaining_due = new_remaining,
        payment_status = new_status
    WHERE id = rec.id;

  UPDATE public.rent_payments
    SET verification_status = 'verified',
        reviewer_note = _note,
        verified_by = reviewer,
        verified_at = now(),
        applied_amount = applied,
        credit_amount = excess,
        receipt_number = coalesce(
          receipt_number,
          'APT-' || to_char(now(), 'YYYYMM') || '-' ||
            lpad(nextval('public.receipt_number_seq')::text, 5, '0')
        )
    WHERE id = _payment_id
    RETURNING * INTO pay;

  IF excess > 0 THEN
    INSERT INTO public.tenant_credits (
      tenant_id, building_id, flat_id, amount, source_payment_id, remaining_amount
    ) VALUES (
      pay.tenant_id, pay.building_id, pay.flat_id, excess, pay.id, excess
    );
  END IF;

  RETURN pay;
END;
$$;

REVOKE ALL ON FUNCTION public.review_rent_payment(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_rent_payment(uuid, text, text) TO authenticated, service_role;

-- 8. Private storage policies for payment proofs
CREATE POLICY "Tenants can upload own payment proofs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Tenants can read own payment proofs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Reviewers can read tenant payment proofs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND public.can_review_tenant(((storage.foldername(name))[1])::uuid, auth.uid())
);
