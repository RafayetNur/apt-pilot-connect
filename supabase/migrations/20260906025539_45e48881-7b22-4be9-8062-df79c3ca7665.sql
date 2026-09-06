-- 1. Column + index
ALTER TABLE public.buildings
  ADD COLUMN assigned_manager_id uuid NULL
    REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX buildings_assigned_manager_id_idx
  ON public.buildings (assigned_manager_id);

-- 2. Data-integrity validation trigger (not an authorization trigger)
CREATE OR REPLACE FUNCTION app_private.validate_assigned_manager()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF NEW.assigned_manager_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles p
       WHERE p.id = NEW.assigned_manager_id
         AND p.role = 'manager'::public.app_role
     ) THEN
    RAISE EXCEPTION 'assigned_manager_id must reference a profile with role manager';
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION app_private.validate_assigned_manager() FROM PUBLIC;

CREATE TRIGGER buildings_validate_assigned_manager
  BEFORE INSERT OR UPDATE OF assigned_manager_id ON public.buildings
  FOR EACH ROW EXECUTE FUNCTION app_private.validate_assigned_manager();

-- 3. Abort if the audited mapping has changed
DO $chk$
DECLARE
  v_total int; v_unique int; v_ambiguous int; v_unmatched int; v_email_rows int;
BEGIN
  SELECT count(*) INTO v_total FROM public.buildings;

  SELECT count(*) FILTER (WHERE m.c = 1),
         count(*) FILTER (WHERE m.c > 1),
         count(*) FILTER (WHERE m.c = 0)
    INTO v_unique, v_ambiguous, v_unmatched
  FROM public.buildings b
  CROSS JOIN LATERAL (
    SELECT count(*) AS c FROM public.profiles p
    WHERE p.role = 'manager'::public.app_role
      AND lower(btrim(p.email)) = lower(btrim(b.assigned_manager))
  ) m;

  SELECT count(*) INTO v_email_rows FROM public.buildings b
  WHERE lower(btrim(b.assigned_manager)) = 'teamapar10ms@gmail.com';

  IF v_total <> 2 OR v_unique <> 2 OR v_ambiguous <> 0 OR v_unmatched <> 0 OR v_email_rows <> 2 THEN
    RAISE EXCEPTION
      'Mapping changed since audit (buildings=%, unique=%, ambiguous=%, unmatched=%, expected_email_rows=%) - aborting',
      v_total, v_unique, v_ambiguous, v_unmatched, v_email_rows;
  END IF;
END
$chk$;

-- 4. Backfill uniquely email-matched rows only; legacy text untouched
UPDATE public.buildings b
SET assigned_manager_id = p.id
FROM public.profiles p
WHERE b.assigned_manager_id IS NULL
  AND p.role = 'manager'::public.app_role
  AND lower(btrim(p.email)) = lower(btrim(b.assigned_manager))
  AND (SELECT count(*) FROM public.profiles p2
        WHERE p2.role = 'manager'::public.app_role
          AND lower(btrim(p2.email)) = lower(btrim(b.assigned_manager))) = 1;

-- 5. Verify the backfill before authorization changes
DO $vfy$
DECLARE v_filled int;
BEGIN
  SELECT count(*) INTO v_filled
  FROM public.buildings b
  JOIN public.profiles p ON p.id = b.assigned_manager_id
  WHERE p.role = 'manager'::public.app_role;

  IF v_filled <> 2 THEN
    RAISE EXCEPTION 'Backfill verification failed: % buildings linked to a manager profile, expected 2', v_filled;
  END IF;
END
$vfy$;

-- 6. Atomic authorization switch
CREATE OR REPLACE FUNCTION app_private.can_view_building(building_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $f1$
  SELECT EXISTS (
    SELECT 1 FROM public.buildings b
    WHERE b.id = building_uuid AND b.owner_id = user_uuid
      AND app_private.has_role(user_uuid, 'owner'::public.app_role)
  )
  OR EXISTS (
    SELECT 1 FROM public.buildings b
    WHERE b.id = building_uuid
      AND b.assigned_manager_id = user_uuid
      AND app_private.has_role(user_uuid, 'manager'::public.app_role)
  )
  OR EXISTS (
    SELECT 1
    FROM public.flats f
    JOIN public.profiles p ON p.id = user_uuid
    WHERE f.building_id = building_uuid
      AND f.tenant_id = user_uuid
      AND p.role = 'tenant'::public.app_role
  )
$f1$;

CREATE OR REPLACE FUNCTION app_private.can_review_building(building_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $f2$
  SELECT EXISTS (
    SELECT 1 FROM public.buildings b
    WHERE b.id = building_uuid AND b.owner_id = user_uuid
      AND app_private.has_role(user_uuid, 'owner'::public.app_role)
  )
  OR EXISTS (
    SELECT 1 FROM public.buildings b
    WHERE b.id = building_uuid
      AND b.assigned_manager_id = user_uuid
      AND app_private.has_role(user_uuid, 'manager'::public.app_role)
  )
$f2$;

DROP POLICY "Managers can view flats of assigned buildings" ON public.flats;
CREATE POLICY "Managers can view flats of assigned buildings"
  ON public.flats FOR SELECT TO authenticated
  USING (app_private.can_view_building(building_id, auth.uid()));

DROP POLICY "Managers can view rent of assigned buildings" ON public.rent_records;
CREATE POLICY "Managers can view rent of assigned buildings"
  ON public.rent_records FOR SELECT TO authenticated
  USING (app_private.can_view_building(building_id, auth.uid()));

-- 7. Owner-only assignment RPC
CREATE OR REPLACE FUNCTION public.assign_building_manager(_building_id uuid, _manager_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $rpc$
DECLARE v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.buildings b
    WHERE b.id = _building_id
      AND b.owner_id = v_caller
      AND app_private.has_role(v_caller, 'owner'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Only the owner of this building can assign its manager';
  END IF;

  IF _manager_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _manager_id AND p.role = 'manager'::public.app_role
  ) THEN
    RAISE EXCEPTION 'Selected account is not a manager';
  END IF;

  UPDATE public.buildings b
  SET assigned_manager_id = _manager_id,
      assigned_manager = COALESCE((SELECT p.email FROM public.profiles p WHERE p.id = _manager_id), ''),
      updated_at = pg_catalog.now()
  WHERE b.id = _building_id;
END;
$rpc$;

REVOKE ALL ON FUNCTION public.assign_building_manager(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_building_manager(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.assign_building_manager(uuid, uuid) TO authenticated;

-- 8. Final scan: no authorization surface may still use the legacy text
DO $scan$
DECLARE v_bad int;
BEGIN
  SELECT count(*) INTO v_bad
  FROM pg_policy pol
  JOIN pg_class c ON c.oid = pol.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND (coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') ~ 'assigned_manager[^_a-zA-Z0-9]'
      OR coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') ~ 'assigned_manager[^_a-zA-Z0-9]');
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Legacy assigned_manager text still used in % policy expression(s)', v_bad;
  END IF;

  SELECT count(*) INTO v_bad
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname IN ('public', 'app_private')
    AND p.proname <> 'assign_building_manager'
    AND p.proname <> 'validate_assigned_manager'
    AND p.prosrc ~ 'assigned_manager[^_a-zA-Z0-9]';
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Legacy assigned_manager text still referenced in % routine(s)', v_bad;
  END IF;
END
$scan$;