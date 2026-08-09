-- 1. Enum
DO $$ BEGIN
  CREATE TYPE public.month_closure_status AS ENUM ('open', 'closed', 'reopened');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.month_closure_action AS ENUM ('closed', 'reopened');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Tables
CREATE TABLE public.building_month_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  billing_month date NOT NULL,
  status public.month_closure_status NOT NULL DEFAULT 'open',
  closed_by uuid REFERENCES public.profiles(id),
  closed_at timestamptz,
  closing_note text,
  reopened_by uuid REFERENCES public.profiles(id),
  reopened_at timestamptz,
  reopening_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT building_month_closures_unique UNIQUE (building_id, billing_month)
);

CREATE INDEX building_month_closures_building_idx
  ON public.building_month_closures (building_id, billing_month);
CREATE INDEX building_month_closures_status_idx
  ON public.building_month_closures (status);

CREATE TABLE public.building_month_closure_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closure_id uuid NOT NULL REFERENCES public.building_month_closures(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  billing_month date NOT NULL,
  action public.month_closure_action NOT NULL,
  performed_by uuid NOT NULL REFERENCES public.profiles(id),
  reason_or_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX building_month_closure_events_closure_idx
  ON public.building_month_closure_events (closure_id, created_at DESC);

GRANT SELECT ON public.building_month_closures TO authenticated;
GRANT ALL ON public.building_month_closures TO service_role;
GRANT SELECT ON public.building_month_closure_events TO authenticated;
GRANT ALL ON public.building_month_closure_events TO service_role;

ALTER TABLE public.building_month_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.building_month_closure_events ENABLE ROW LEVEL SECURITY;

-- 3. Owner-only helper (non-recursive: reads buildings/profiles as definer)
CREATE OR REPLACE FUNCTION public.is_building_owner(building_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.buildings b
    WHERE b.id = building_uuid
      AND b.owner_id = user_uuid
      AND public.has_role(user_uuid, 'owner'::public.app_role)
  )
$$;

REVOKE ALL ON FUNCTION public.is_building_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_building_owner(uuid, uuid) TO authenticated, service_role;

-- 4. Read policies
CREATE POLICY "Owners and managers can view closures"
  ON public.building_month_closures FOR SELECT TO authenticated
  USING (public.can_view_building(building_id, auth.uid()));

CREATE POLICY "Tenants can view closure of own billed months"
  ON public.building_month_closures FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.rent_records r
    WHERE r.building_id = building_month_closures.building_id
      AND r.billing_month = building_month_closures.billing_month
      AND r.tenant_id = auth.uid()
  ));

CREATE POLICY "Owners and managers can view closure events"
  ON public.building_month_closure_events FOR SELECT TO authenticated
  USING (public.can_view_building(building_id, auth.uid()));

-- 5. Closed-month state helper
CREATE OR REPLACE FUNCTION public.is_month_closed(_building_id uuid, _billing_month date)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.building_month_closures c
    WHERE c.building_id = _building_id
      AND c.billing_month = _billing_month
      AND c.status = 'closed'::public.month_closure_status
  )
$$;

REVOKE ALL ON FUNCTION public.is_month_closed(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_month_closed(uuid, date) TO authenticated, service_role;

-- 6. Guard triggers
CREATE OR REPLACE FUNCTION public.guard_closed_month_rent_records()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF public.is_month_closed(OLD.building_id, OLD.billing_month) THEN
      RAISE EXCEPTION 'month_closed: this billing month is closed for this building.';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF public.is_month_closed(NEW.building_id, NEW.billing_month) THEN
      RAISE EXCEPTION 'month_closed: this billing month is closed for this building.';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: allow payment-driven changes, block bill component edits
  IF public.is_month_closed(NEW.building_id, NEW.billing_month) THEN
    IF NEW.base_rent IS DISTINCT FROM OLD.base_rent
       OR NEW.due_date IS DISTINCT FROM OLD.due_date
       OR NEW.billing_month IS DISTINCT FROM OLD.billing_month
       OR NEW.building_id IS DISTINCT FROM OLD.building_id
       OR NEW.flat_id IS DISTINCT FROM OLD.flat_id
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
      RAISE EXCEPTION 'month_closed: bill components of a closed month cannot be edited.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_closed_month_rent_records
  BEFORE INSERT OR UPDATE OR DELETE ON public.rent_records
  FOR EACH ROW EXECUTE FUNCTION public.guard_closed_month_rent_records();

CREATE OR REPLACE FUNCTION public.guard_closed_month_charges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  b uuid;
  m date;
BEGIN
  IF TG_OP = 'DELETE' THEN
    b := OLD.building_id;
  ELSE
    b := NEW.building_id;
  END IF;

  IF TG_TABLE_NAME = 'shared_charge_allocations' THEN
    SELECT r.billing_month INTO m FROM public.rent_records r
     WHERE r.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.rent_record_id ELSE NEW.rent_record_id END;
  ELSE
    m := CASE WHEN TG_OP = 'DELETE' THEN OLD.billing_month ELSE NEW.billing_month END;
  END IF;

  IF m IS NOT NULL AND public.is_month_closed(b, m) THEN
    RAISE EXCEPTION 'month_closed: charges of a closed month cannot be added, edited or removed.';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_closed_month_flat_charges
  BEFORE INSERT OR UPDATE OR DELETE ON public.flat_bill_charges
  FOR EACH ROW EXECUTE FUNCTION public.guard_closed_month_charges();

CREATE TRIGGER guard_closed_month_shared_charges
  BEFORE INSERT OR UPDATE OR DELETE ON public.shared_building_charges
  FOR EACH ROW EXECUTE FUNCTION public.guard_closed_month_charges();

CREATE TRIGGER guard_closed_month_allocations
  BEFORE INSERT OR UPDATE OR DELETE ON public.shared_charge_allocations
  FOR EACH ROW EXECUTE FUNCTION public.guard_closed_month_charges();

CREATE OR REPLACE FUNCTION public.guard_closed_month_adjustments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF public.is_month_closed(NEW.building_id, NEW.posted_billing_month) THEN
    RAISE EXCEPTION 'month_closed: post this adjustment to the next open month instead.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_closed_month_adjustments
  BEFORE INSERT ON public.bill_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.guard_closed_month_adjustments();

CREATE TRIGGER building_month_closures_updated_at
  BEFORE UPDATE ON public.building_month_closures
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. Close / reopen RPCs
CREATE OR REPLACE FUNCTION public.close_building_month(
  _building_id uuid,
  _billing_month date,
  _note text DEFAULT NULL
)
RETURNS public.building_month_closures
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  actor uuid := auth.uid();
  closure public.building_month_closures;
  blockers text[] := ARRAY[]::text[];
  n integer;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  IF NOT public.is_building_owner(_building_id, actor) THEN
    RAISE EXCEPTION 'Only the building owner can close a billing month.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(_building_id::text || _billing_month::text));

  SELECT * INTO closure FROM public.building_month_closures
   WHERE building_id = _building_id AND billing_month = _billing_month FOR UPDATE;

  IF closure.id IS NOT NULL AND closure.status = 'closed'::public.month_closure_status THEN
    RAISE EXCEPTION 'This month is already closed.';
  END IF;

  SELECT count(*) INTO n FROM public.rent_payments p
   WHERE p.building_id = _building_id
     AND p.verification_status = 'pending'::public.verification_status
     AND EXISTS (SELECT 1 FROM public.rent_records r WHERE r.id = p.rent_record_id AND r.billing_month = _billing_month);
  IF n > 0 THEN blockers := blockers || format('%s pending payment submission(s)', n); END IF;

  SELECT count(*) INTO n FROM public.bill_adjustments a
   WHERE a.building_id = _building_id
     AND a.posted_billing_month = _billing_month
     AND a.approval_status = 'pending'::public.approval_status;
  IF n > 0 THEN blockers := blockers || format('%s pending bill adjustment(s)', n); END IF;

  SELECT count(*) INTO n FROM public.shared_building_charges s
   WHERE s.building_id = _building_id AND s.billing_month = _billing_month
     AND NOT EXISTS (SELECT 1 FROM public.shared_charge_allocations al WHERE al.shared_charge_id = s.id);
  IF n > 0 THEN blockers := blockers || format('%s shared charge(s) not split among flats', n); END IF;

  SELECT count(*) INTO n FROM public.flats f
   WHERE f.building_id = _building_id
     AND f.occupancy_status = 'occupied'::public.occupancy_status
     AND f.tenant_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.rent_records r
       WHERE r.flat_id = f.id AND r.billing_month = _billing_month
     );
  IF n > 0 THEN blockers := blockers || format('%s occupied flat(s) without a rent record', n); END IF;

  SELECT count(*) INTO n FROM public.rent_records r
   WHERE r.building_id = _building_id AND r.billing_month = _billing_month
     AND (
       r.total_payable <> GREATEST(r.base_rent + r.individual_charges_total + r.shared_charges_total + r.adjustment_total, 0)
       OR r.remaining_due <> GREATEST(r.total_payable - r.total_paid, 0)
     );
  IF n > 0 THEN blockers := blockers || format('%s rent record(s) with inconsistent totals', n); END IF;

  IF array_length(blockers, 1) > 0 THEN
    RAISE EXCEPTION 'Cannot close this month: %', array_to_string(blockers, '; ');
  END IF;

  IF closure.id IS NULL THEN
    INSERT INTO public.building_month_closures (
      building_id, billing_month, status, closed_by, closed_at, closing_note
    ) VALUES (
      _building_id, _billing_month, 'closed'::public.month_closure_status, actor, now(),
      NULLIF(btrim(coalesce(_note, '')), '')
    ) RETURNING * INTO closure;
  ELSE
    UPDATE public.building_month_closures
       SET status = 'closed'::public.month_closure_status,
           closed_by = actor,
           closed_at = now(),
           closing_note = NULLIF(btrim(coalesce(_note, '')), '')
     WHERE id = closure.id RETURNING * INTO closure;
  END IF;

  INSERT INTO public.building_month_closure_events (
    closure_id, building_id, billing_month, action, performed_by, reason_or_note
  ) VALUES (
    closure.id, _building_id, _billing_month, 'closed'::public.month_closure_action, actor,
    NULLIF(btrim(coalesce(_note, '')), '')
  );

  RETURN closure;
END;
$$;

REVOKE ALL ON FUNCTION public.close_building_month(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_building_month(uuid, date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reopen_building_month(
  _building_id uuid,
  _billing_month date,
  _reason text
)
RETURNS public.building_month_closures
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  actor uuid := auth.uid();
  closure public.building_month_closures;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  IF NOT public.is_building_owner(_building_id, actor) THEN
    RAISE EXCEPTION 'Only the building owner can reopen a billing month.';
  END IF;
  IF coalesce(btrim(_reason), '') = '' THEN
    RAISE EXCEPTION 'A reopening reason is required.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(_building_id::text || _billing_month::text));

  SELECT * INTO closure FROM public.building_month_closures
   WHERE building_id = _building_id AND billing_month = _billing_month FOR UPDATE;

  IF closure.id IS NULL OR closure.status <> 'closed'::public.month_closure_status THEN
    RAISE EXCEPTION 'This month is not currently closed.';
  END IF;

  UPDATE public.building_month_closures
     SET status = 'reopened'::public.month_closure_status,
         reopened_by = actor,
         reopened_at = now(),
         reopening_reason = btrim(_reason)
   WHERE id = closure.id RETURNING * INTO closure;

  INSERT INTO public.building_month_closure_events (
    closure_id, building_id, billing_month, action, performed_by, reason_or_note
  ) VALUES (
    closure.id, _building_id, _billing_month, 'reopened'::public.month_closure_action, actor, btrim(_reason)
  );

  RETURN closure;
END;
$$;

REVOKE ALL ON FUNCTION public.reopen_building_month(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_building_month(uuid, date, text) TO authenticated;