-- 1. Role escalation hardening -------------------------------------------------

CREATE OR REPLACE FUNCTION public.prevent_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND coalesce(current_setting('app.role_change_ok', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Role changes are not allowed here. An owner must assign roles.';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Profile id cannot be changed.';
  END IF;
  RETURN NEW;
END;
$function$;

-- self-signup may never claim a manager account
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  meta_role text := NEW.raw_user_meta_data ->> 'role';
  safe_role public.app_role;
BEGIN
  IF meta_role IN ('owner','tenant') THEN
    safe_role := meta_role::public.app_role;
  ELSE
    safe_role := 'tenant'::public.app_role;
  END IF;

  INSERT INTO public.profiles (id, full_name, email, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''), split_part(COALESCE(NEW.email, 'Member'), '@', 1)),
    COALESCE(NEW.email, ''),
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data ->> 'phone'), ''), ''),
    safe_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- self-insert fallback may only create a tenant profile
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own tenant profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id AND role = 'tenant'::public.app_role);

-- authorized role assignment (owners only, manager/tenant only)
CREATE OR REPLACE FUNCTION public.assign_user_role(_user_id uuid, _role public.app_role)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  actor uuid := auth.uid();
  target public.profiles;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'You must be signed in.'; END IF;
  IF NOT public.has_role(actor, 'owner'::public.app_role) THEN
    RAISE EXCEPTION 'Only an owner can assign roles.';
  END IF;
  IF _user_id = actor THEN
    RAISE EXCEPTION 'You cannot change your own role.';
  END IF;
  IF _role NOT IN ('manager'::public.app_role, 'tenant'::public.app_role) THEN
    RAISE EXCEPTION 'Only manager or tenant roles can be assigned.';
  END IF;

  SELECT * INTO target FROM public.profiles WHERE id = _user_id;
  IF target.id IS NULL THEN RAISE EXCEPTION 'That user does not exist.'; END IF;
  IF target.role = 'owner'::public.app_role THEN
    RAISE EXCEPTION 'Owner accounts cannot be changed.';
  END IF;

  PERFORM set_config('app.role_change_ok', 'on', true);
  UPDATE public.profiles SET role = _role WHERE id = _user_id RETURNING * INTO target;
  PERFORM set_config('app.role_change_ok', 'off', true);

  RETURN target;
END;
$function$;

-- 2/3. Identity immutability for maintenance requests and work orders ----------

CREATE OR REPLACE FUNCTION public.maintenance_requests_lock_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.building_id IS DISTINCT FROM OLD.building_id
     OR NEW.flat_id IS DISTINCT FROM OLD.flat_id
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.submitted_by IS DISTINCT FROM OLD.submitted_by
     OR NEW.request_number IS DISTINCT FROM OLD.request_number THEN
    RAISE EXCEPTION 'A request cannot be moved to another building, flat or tenant.';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS maintenance_requests_lock_identity ON public.maintenance_requests;
CREATE TRIGGER maintenance_requests_lock_identity
  BEFORE UPDATE ON public.maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION public.maintenance_requests_lock_identity();

CREATE OR REPLACE FUNCTION public.work_orders_lock_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.building_id IS DISTINCT FROM OLD.building_id
     OR NEW.maintenance_request_id IS DISTINCT FROM OLD.maintenance_request_id
     OR NEW.work_order_number IS DISTINCT FROM OLD.work_order_number THEN
    RAISE EXCEPTION 'A work order cannot be moved to another building or request.';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS work_orders_lock_identity ON public.work_orders;
CREATE TRIGGER work_orders_lock_identity
  BEFORE UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.work_orders_lock_identity();

-- tenants may read work orders tied to a request they can see
DROP POLICY IF EXISTS "Requesters view their work orders" ON public.work_orders;
CREATE POLICY "Requesters view their work orders"
  ON public.work_orders FOR SELECT TO authenticated
  USING (public.can_view_maintenance_request(maintenance_request_id, auth.uid()));

-- 4. Function EXECUTE grants ----------------------------------------------------

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig,
           pg_get_function_result(p.oid) = 'trigger' AS is_trigger
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    IF r.is_trigger THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', r.sig);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    END IF;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;
