-- 1. Enum values for withdrawal / cancellation (must be committed before literal use)
ALTER TYPE public.verification_status ADD VALUE IF NOT EXISTS 'withdrawn';
ALTER TYPE public.verification_status ADD VALUE IF NOT EXISTS 'cancelled';

-- 2. New enums
DO $$ BEGIN
  CREATE TYPE public.adjustment_type AS ENUM ('debit', 'credit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.adjustment_category AS ENUM ('electricity','gas','water','internet','shared_charge','flat_repair','correction','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.approval_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. rent_records adjustment total
ALTER TABLE public.rent_records
  ADD COLUMN IF NOT EXISTS adjustment_total numeric NOT NULL DEFAULT 0;

-- 4. tenant_credits: source adjustment (duplicate protection)
ALTER TABLE public.tenant_credits
  ADD COLUMN IF NOT EXISTS source_adjustment_id uuid;

-- 5. bill_adjustments
CREATE TABLE IF NOT EXISTS public.bill_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rent_record_id uuid NOT NULL REFERENCES public.rent_records(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  flat_id uuid NOT NULL REFERENCES public.flats(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  original_billing_month date NOT NULL,
  posted_billing_month date NOT NULL,
  adjustment_type public.adjustment_type NOT NULL,
  category public.adjustment_category NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  supporting_document_url text,
  approval_status public.approval_status NOT NULL DEFAULT 'pending',
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  reviewer_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bill_adjustments ADD COLUMN IF NOT EXISTS source_credit_created boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS bill_adjustments_record_idx ON public.bill_adjustments(rent_record_id);
CREATE INDEX IF NOT EXISTS bill_adjustments_building_idx ON public.bill_adjustments(building_id);
CREATE UNIQUE INDEX IF NOT EXISTS tenant_credits_unique_adjustment
  ON public.tenant_credits(source_adjustment_id) WHERE source_adjustment_id IS NOT NULL;

GRANT SELECT, INSERT ON public.bill_adjustments TO authenticated;
GRANT ALL ON public.bill_adjustments TO service_role;

ALTER TABLE public.bill_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reviewers and own tenant can view adjustments" ON public.bill_adjustments;
CREATE POLICY "Reviewers and own tenant can view adjustments"
  ON public.bill_adjustments FOR SELECT TO authenticated
  USING (public.can_review_building(building_id, auth.uid()) OR tenant_id = auth.uid());

DROP POLICY IF EXISTS "Reviewers can create adjustments" ON public.bill_adjustments;
CREATE POLICY "Reviewers can create adjustments"
  ON public.bill_adjustments FOR INSERT TO authenticated
  WITH CHECK (
    public.can_review_building(building_id, auth.uid())
    AND created_by = auth.uid()
    AND approval_status = 'pending'::public.approval_status
    AND approved_by IS NULL
    AND approved_at IS NULL
  );

DROP TRIGGER IF EXISTS set_bill_adjustments_updated_at ON public.bill_adjustments;
CREATE TRIGGER set_bill_adjustments_updated_at
  BEFORE UPDATE ON public.bill_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. private supporting document access
DROP POLICY IF EXISTS "Adjustment parties can read supporting documents" ON storage.objects;
CREATE POLICY "Adjustment parties can read supporting documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND EXISTS (
      SELECT 1 FROM public.bill_adjustments a
      WHERE a.supporting_document_url = storage.objects.name
        AND (public.can_review_building(a.building_id, auth.uid()) OR a.tenant_id = auth.uid())
    )
  );

-- 7. totals now include adjustments
CREATE OR REPLACE FUNCTION public.rent_records_set_remaining()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.total_paid < 0 THEN NEW.total_paid := 0; END IF;
  NEW.individual_charges_total := GREATEST(COALESCE(NEW.individual_charges_total, 0), 0);
  NEW.shared_charges_total := GREATEST(COALESCE(NEW.shared_charges_total, 0), 0);
  NEW.adjustment_total := COALESCE(NEW.adjustment_total, 0);
  NEW.total_payable := GREATEST(
    COALESCE(NEW.base_rent, 0) + NEW.individual_charges_total + NEW.shared_charges_total + NEW.adjustment_total,
    0
  );
  NEW.remaining_due := GREATEST(NEW.total_payable - NEW.total_paid, 0);
  IF NEW.total_paid > 0 AND NEW.remaining_due = 0 THEN
    NEW.payment_status := 'paid'::public.payment_status;
  ELSIF NEW.total_paid > 0 THEN
    NEW.payment_status := 'partially_paid'::public.payment_status;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalc_rent_record_totals(_rent_record_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  UPDATE public.rent_records r
  SET individual_charges_total = COALESCE((
        SELECT SUM(c.amount) FROM public.flat_bill_charges c WHERE c.rent_record_id = r.id
      ), 0),
      shared_charges_total = COALESCE((
        SELECT SUM(a.allocated_amount) FROM public.shared_charge_allocations a WHERE a.rent_record_id = r.id
      ), 0),
      adjustment_total = COALESCE((
        SELECT SUM(CASE WHEN j.adjustment_type = 'debit'::public.adjustment_type THEN j.amount ELSE -j.amount END)
        FROM public.bill_adjustments j
        WHERE j.rent_record_id = r.id
          AND j.approval_status = 'approved'::public.approval_status
      ), 0)
  WHERE r.id = _rent_record_id;
END;
$function$;

-- 8. withdraw / cancel a pending payment
CREATE OR REPLACE FUNCTION public.withdraw_rent_payment(_payment_id uuid, _reason text DEFAULT NULL)
RETURNS public.rent_payments LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  pay public.rent_payments;
  actor uuid := auth.uid();
  is_reviewer boolean;
  next_status text;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;

  SELECT * INTO pay FROM public.rent_payments WHERE id = _payment_id FOR UPDATE;
  IF pay.id IS NULL THEN RAISE EXCEPTION 'Payment not found.'; END IF;

  IF pay.verification_status::text <> 'pending' THEN
    RAISE EXCEPTION 'Only a pending payment submission can be withdrawn or cancelled.';
  END IF;

  is_reviewer := public.can_review_building(pay.building_id, actor);

  IF pay.tenant_id = actor AND NOT is_reviewer THEN
    next_status := 'withdrawn';
  ELSIF is_reviewer THEN
    next_status := 'cancelled';
    IF coalesce(btrim(_reason), '') = '' THEN
      RAISE EXCEPTION 'A reason is required to cancel a tenant submission.';
    END IF;
  ELSE
    RAISE EXCEPTION 'You are not allowed to withdraw this payment.';
  END IF;

  UPDATE public.rent_payments
     SET verification_status = next_status::public.verification_status,
         reviewer_note = COALESCE(NULLIF(btrim(_reason), ''), reviewer_note),
         verified_by = CASE WHEN next_status = 'cancelled' THEN actor ELSE verified_by END,
         verified_at = now()
   WHERE id = _payment_id
   RETURNING * INTO pay;

  RETURN pay;
END;
$function$;

REVOKE ALL ON FUNCTION public.withdraw_rent_payment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdraw_rent_payment(uuid, text) TO authenticated, service_role;

-- 9. approve / reject an adjustment atomically
CREATE OR REPLACE FUNCTION public.review_bill_adjustment(_adjustment_id uuid, _action text, _note text DEFAULT NULL)
RETURNS public.bill_adjustments LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  adj public.bill_adjustments;
  rec public.rent_records;
  reviewer uuid := auth.uid();
  other_reviewers integer;
  excess numeric;
BEGIN
  IF reviewer IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;

  SELECT * INTO adj FROM public.bill_adjustments WHERE id = _adjustment_id FOR UPDATE;
  IF adj.id IS NULL THEN RAISE EXCEPTION 'Adjustment not found.'; END IF;

  IF NOT public.can_review_building(adj.building_id, reviewer) THEN
    RAISE EXCEPTION 'You are not allowed to review adjustments for this building.';
  END IF;

  IF adj.approval_status <> 'pending'::public.approval_status THEN
    RAISE EXCEPTION 'This adjustment has already been reviewed.';
  END IF;

  IF adj.created_by = reviewer THEN
    SELECT count(*) INTO other_reviewers
    FROM public.profiles p
    WHERE p.id <> reviewer
      AND public.can_review_building(adj.building_id, p.id);
    IF other_reviewers > 0 THEN
      RAISE EXCEPTION 'You cannot approve your own adjustment while another reviewer is available.';
    END IF;
  END IF;

  IF _action = 'reject' THEN
    IF coalesce(btrim(_note), '') = '' THEN
      RAISE EXCEPTION 'A reviewer note is required when rejecting an adjustment.';
    END IF;
    UPDATE public.bill_adjustments
       SET approval_status = 'rejected'::public.approval_status,
           reviewer_note = _note, approved_by = reviewer, approved_at = now()
     WHERE id = _adjustment_id RETURNING * INTO adj;
    RETURN adj;
  ELSIF _action <> 'approve' THEN
    RAISE EXCEPTION 'Unknown review action.';
  END IF;

  UPDATE public.bill_adjustments
     SET approval_status = 'approved'::public.approval_status,
         reviewer_note = NULLIF(btrim(coalesce(_note, '')), ''),
         approved_by = reviewer, approved_at = now()
   WHERE id = _adjustment_id RETURNING * INTO adj;

  PERFORM pg_advisory_xact_lock(hashtext(adj.rent_record_id::text));
  PERFORM public.recalc_rent_record_totals(adj.rent_record_id);

  SELECT * INTO rec FROM public.rent_records WHERE id = adj.rent_record_id FOR UPDATE;

  excess := GREATEST(rec.total_paid - rec.total_payable, 0);
  IF excess > 0 AND NOT adj.source_credit_created THEN
    INSERT INTO public.tenant_credits (
      tenant_id, building_id, flat_id, amount, remaining_amount, source_adjustment_id
    ) VALUES (
      rec.tenant_id, rec.building_id, rec.flat_id, excess, excess, adj.id
    )
    ON CONFLICT (source_adjustment_id) WHERE source_adjustment_id IS NOT NULL DO NOTHING;

    UPDATE public.bill_adjustments SET source_credit_created = true
     WHERE id = adj.id RETURNING * INTO adj;
  END IF;

  RETURN adj;
END;
$function$;

REVOKE ALL ON FUNCTION public.review_bill_adjustment(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_bill_adjustment(uuid, text, text) TO authenticated, service_role;