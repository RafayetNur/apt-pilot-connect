-- 1. Enums
CREATE TYPE public.flat_charge_type AS ENUM ('electricity','gas','water','internet','flat_repair','other');
CREATE TYPE public.shared_charge_category AS ENUM ('guard_salary','cleaner_salary','generator','lift_maintenance','common_electricity','water_pump','waste_management','cctv_internet','other');

-- 2. rent_records combined payable columns
ALTER TABLE public.rent_records
  ADD COLUMN IF NOT EXISTS individual_charges_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shared_charges_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_payable numeric NOT NULL DEFAULT 0;

-- 3. Individual flat bills
CREATE TABLE public.flat_bill_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rent_record_id uuid NOT NULL REFERENCES public.rent_records(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  flat_id uuid NOT NULL REFERENCES public.flats(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.profiles(id),
  billing_month date NOT NULL,
  charge_type public.flat_charge_type NOT NULL,
  amount numeric NOT NULL DEFAULT 0 CHECK (amount >= 0),
  provider_name text,
  bill_reference text,
  description text,
  entered_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX flat_bill_charges_unique_type_per_record
  ON public.flat_bill_charges (rent_record_id, charge_type);
CREATE INDEX flat_bill_charges_building_month_idx
  ON public.flat_bill_charges (building_id, billing_month);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.flat_bill_charges TO authenticated;
GRANT ALL ON public.flat_bill_charges TO service_role;
ALTER TABLE public.flat_bill_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviewers and own tenant can view flat charges"
  ON public.flat_bill_charges FOR SELECT TO authenticated
  USING (public.can_review_building(building_id, auth.uid()) OR tenant_id = auth.uid());
CREATE POLICY "Reviewers can insert flat charges"
  ON public.flat_bill_charges FOR INSERT TO authenticated
  WITH CHECK (public.can_review_building(building_id, auth.uid()) AND entered_by = auth.uid());
CREATE POLICY "Reviewers can update flat charges"
  ON public.flat_bill_charges FOR UPDATE TO authenticated
  USING (public.can_review_building(building_id, auth.uid()))
  WITH CHECK (public.can_review_building(building_id, auth.uid()));
CREATE POLICY "Reviewers can delete flat charges"
  ON public.flat_bill_charges FOR DELETE TO authenticated
  USING (public.can_review_building(building_id, auth.uid()));

-- 4. Shared building charges
CREATE TABLE public.shared_building_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  billing_month date NOT NULL,
  category public.shared_charge_category NOT NULL,
  total_amount numeric NOT NULL CHECK (total_amount > 0),
  description text,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shared_building_charges_building_month_idx
  ON public.shared_building_charges (building_id, billing_month);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_building_charges TO authenticated;
GRANT ALL ON public.shared_building_charges TO service_role;
ALTER TABLE public.shared_building_charges ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.shared_charge_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_charge_id uuid NOT NULL REFERENCES public.shared_building_charges(id) ON DELETE CASCADE,
  rent_record_id uuid NOT NULL REFERENCES public.rent_records(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  flat_id uuid NOT NULL REFERENCES public.flats(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.profiles(id),
  allocated_amount numeric NOT NULL CHECK (allocated_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX shared_charge_allocations_unique_per_record
  ON public.shared_charge_allocations (shared_charge_id, rent_record_id);
CREATE INDEX shared_charge_allocations_record_idx
  ON public.shared_charge_allocations (rent_record_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shared_charge_allocations TO authenticated;
GRANT ALL ON public.shared_charge_allocations TO service_role;
ALTER TABLE public.shared_charge_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviewers and own tenant can view allocations"
  ON public.shared_charge_allocations FOR SELECT TO authenticated
  USING (public.can_review_building(building_id, auth.uid()) OR tenant_id = auth.uid());
CREATE POLICY "Reviewers can delete allocations"
  ON public.shared_charge_allocations FOR DELETE TO authenticated
  USING (public.can_review_building(building_id, auth.uid()));

CREATE POLICY "Reviewers and allocated tenants can view shared charges"
  ON public.shared_building_charges FOR SELECT TO authenticated
  USING (
    public.can_review_building(building_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.shared_charge_allocations a
      WHERE a.shared_charge_id = shared_building_charges.id
        AND a.tenant_id = auth.uid()
    )
  );
CREATE POLICY "Reviewers can insert shared charges"
  ON public.shared_building_charges FOR INSERT TO authenticated
  WITH CHECK (public.can_review_building(building_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Reviewers can update shared charges"
  ON public.shared_building_charges FOR UPDATE TO authenticated
  USING (public.can_review_building(building_id, auth.uid()))
  WITH CHECK (public.can_review_building(building_id, auth.uid()));
CREATE POLICY "Reviewers can delete shared charges"
  ON public.shared_building_charges FOR DELETE TO authenticated
  USING (public.can_review_building(building_id, auth.uid()));

CREATE TRIGGER flat_bill_charges_updated_at BEFORE UPDATE ON public.flat_bill_charges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER shared_building_charges_updated_at BEFORE UPDATE ON public.shared_building_charges
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Totals engine
CREATE OR REPLACE FUNCTION public.rent_records_set_remaining()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.total_paid < 0 THEN NEW.total_paid := 0; END IF;
  NEW.individual_charges_total := GREATEST(COALESCE(NEW.individual_charges_total, 0), 0);
  NEW.shared_charges_total := GREATEST(COALESCE(NEW.shared_charges_total, 0), 0);
  NEW.total_payable := COALESCE(NEW.base_rent, 0) + NEW.individual_charges_total + NEW.shared_charges_total;
  NEW.remaining_due := GREATEST(NEW.total_payable - NEW.total_paid, 0);
  IF NEW.total_paid > 0 AND NEW.remaining_due = 0 THEN
    NEW.payment_status := 'paid'::public.payment_status;
  ELSIF NEW.total_paid > 0 THEN
    NEW.payment_status := 'partially_paid'::public.payment_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalc_rent_record_totals(_rent_record_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.rent_records r
  SET individual_charges_total = COALESCE((
        SELECT SUM(c.amount) FROM public.flat_bill_charges c WHERE c.rent_record_id = r.id
      ), 0),
      shared_charges_total = COALESCE((
        SELECT SUM(a.allocated_amount) FROM public.shared_charge_allocations a WHERE a.rent_record_id = r.id
      ), 0)
  WHERE r.id = _rent_record_id;
END;
$$;
REVOKE ALL ON FUNCTION public.recalc_rent_record_totals(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.charges_sync_totals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_rent_record_totals(OLD.rent_record_id);
    RETURN OLD;
  END IF;
  PERFORM public.recalc_rent_record_totals(NEW.rent_record_id);
  IF TG_OP = 'UPDATE' AND OLD.rent_record_id <> NEW.rent_record_id THEN
    PERFORM public.recalc_rent_record_totals(OLD.rent_record_id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.charges_sync_totals() FROM PUBLIC, anon;

CREATE TRIGGER flat_bill_charges_sync_totals
  AFTER INSERT OR UPDATE OR DELETE ON public.flat_bill_charges
  FOR EACH ROW EXECUTE FUNCTION public.charges_sync_totals();
CREATE TRIGGER shared_charge_allocations_sync_totals
  AFTER INSERT OR UPDATE OR DELETE ON public.shared_charge_allocations
  FOR EACH ROW EXECUTE FUNCTION public.charges_sync_totals();

-- 6. Lock charges once a payment exists for the month
CREATE OR REPLACE FUNCTION public.charges_block_when_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  target uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.rent_record_id ELSE NEW.rent_record_id END;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.rent_payments p
    WHERE p.rent_record_id = target
      AND p.verification_status IN ('pending'::public.verification_status, 'verified'::public.verification_status)
  ) THEN
    RAISE EXCEPTION 'charges_locked_by_payment';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.charges_block_when_paid() FROM PUBLIC, anon;

CREATE TRIGGER flat_bill_charges_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.flat_bill_charges
  FOR EACH ROW EXECUTE FUNCTION public.charges_block_when_paid();
CREATE TRIGGER shared_charge_allocations_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.shared_charge_allocations
  FOR EACH ROW EXECUTE FUNCTION public.charges_block_when_paid();

-- 7. Equal-split allocation with safe rounding
CREATE OR REPLACE FUNCTION public.allocate_shared_charge(_shared_charge_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  sc public.shared_building_charges;
  n integer;
  base_share numeric;
  remainder_cents integer;
  idx integer := 0;
  rec record;
  extra numeric;
  actor uuid := auth.uid();
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;

  SELECT * INTO sc FROM public.shared_building_charges WHERE id = _shared_charge_id FOR UPDATE;
  IF sc.id IS NULL THEN RAISE EXCEPTION 'Shared charge not found.'; END IF;

  IF NOT public.can_review_building(sc.building_id, actor) THEN
    RAISE EXCEPTION 'You are not allowed to manage charges for this building.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.shared_charge_allocations WHERE shared_charge_id = _shared_charge_id) THEN
    RAISE EXCEPTION 'This shared charge has already been split among the flats.';
  END IF;

  SELECT count(*) INTO n
  FROM public.rent_records r
  JOIN public.flats f ON f.id = r.flat_id
  WHERE r.building_id = sc.building_id
    AND r.billing_month = sc.billing_month
    AND f.occupancy_status = 'occupied'::public.occupancy_status;

  IF n = 0 THEN
    RAISE EXCEPTION 'No occupied flats have a rent record for this month, so this charge cannot be split. Generate monthly rent first.';
  END IF;

  base_share := trunc(sc.total_amount / n, 2);
  remainder_cents := round((sc.total_amount - base_share * n) * 100)::integer;

  FOR rec IN
    SELECT r.id AS rent_record_id, r.flat_id, r.tenant_id, f.flat_number
    FROM public.rent_records r
    JOIN public.flats f ON f.id = r.flat_id
    WHERE r.building_id = sc.building_id
      AND r.billing_month = sc.billing_month
      AND f.occupancy_status = 'occupied'::public.occupancy_status
    ORDER BY f.flat_number, r.id
  LOOP
    idx := idx + 1;
    extra := CASE WHEN idx <= remainder_cents THEN 0.01 ELSE 0 END;
    INSERT INTO public.shared_charge_allocations (
      shared_charge_id, rent_record_id, building_id, flat_id, tenant_id, allocated_amount
    ) VALUES (
      _shared_charge_id, rec.rent_record_id, sc.building_id, rec.flat_id, rec.tenant_id, base_share + extra
    );
  END LOOP;

  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.allocate_shared_charge(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.allocate_shared_charge(uuid) TO authenticated, service_role;

-- 8. Payment verification now applies against total_payable
CREATE OR REPLACE FUNCTION public.review_rent_payment(_payment_id uuid, _action text, _note text DEFAULT NULL::text)
RETURNS public.rent_payments
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
      SET verification_status = 'rejected', reviewer_note = _note,
          verified_by = reviewer, verified_at = now()
      WHERE id = _payment_id RETURNING * INTO pay;
    RETURN pay;
  ELSIF _action = 'correction_requested' THEN
    UPDATE public.rent_payments
      SET verification_status = 'correction_requested', reviewer_note = _note,
          verified_by = reviewer, verified_at = now()
      WHERE id = _payment_id RETURNING * INTO pay;
    RETURN pay;
  ELSIF _action <> 'verify' THEN
    RAISE EXCEPTION 'Unknown review action.';
  END IF;

  SELECT * INTO rec FROM public.rent_records WHERE id = pay.rent_record_id FOR UPDATE;
  IF rec.id IS NULL THEN
    RAISE EXCEPTION 'Rent record not found.';
  END IF;

  remaining := GREATEST(rec.total_payable - GREATEST(rec.total_paid, 0), 0);
  applied := LEAST(pay.amount_paid, remaining);
  excess := pay.amount_paid - applied;
  new_total := GREATEST(rec.total_paid, 0) + applied;
  new_remaining := GREATEST(rec.total_payable - new_total, 0);

  IF new_remaining = 0 THEN
    new_status := 'paid'::public.payment_status;
  ELSIF new_total > 0 THEN
    new_status := 'partially_paid'::public.payment_status;
  ELSE
    new_status := rec.payment_status;
  END IF;

  UPDATE public.rent_records
    SET total_paid = new_total, remaining_due = new_remaining, payment_status = new_status
    WHERE id = rec.id;

  UPDATE public.rent_payments
    SET verification_status = 'verified', reviewer_note = _note,
        verified_by = reviewer, verified_at = now(),
        applied_amount = applied, credit_amount = excess,
        receipt_number = coalesce(
          receipt_number,
          'APT-' || to_char(now(), 'YYYYMM') || '-' ||
            lpad(nextval('public.receipt_number_seq')::text, 5, '0')
        )
    WHERE id = _payment_id RETURNING * INTO pay;

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

-- 9. Backfill existing rent records through the totals trigger
UPDATE public.rent_records SET base_rent = base_rent;