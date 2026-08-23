CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

DO $do$
DECLARE
  helpers text[] := ARRAY['has_role','can_view_building','can_review_building','can_review_tenant','is_building_owner','can_view_document','can_view_maintenance_request','can_manage_maintenance_request','tenant_can_view_document','tenant_can_view_notice'];
  h text;
  r record;
  def text;
  newdef text;
BEGIN
  -- 1. Move read-only RLS helper functions out of the API-exposed public schema.
  FOREACH h IN ARRAY helpers LOOP
    FOR r IN
      SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = h
    LOOP
      EXECUTE format('ALTER FUNCTION %s SET SCHEMA app_private', r.oid::regprocedure);
    END LOOP;
  END LOOP;

  -- 2. Repoint every remaining function body at the new schema.
  FOR r IN
    SELECT p.oid, pg_get_functiondef(p.oid) AS d
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public','app_private') AND p.prokind = 'f'
  LOOP
    def := r.d;
    newdef := def;
    FOREACH h IN ARRAY helpers LOOP
      newdef := replace(newdef, 'public.' || h || '(', 'app_private.' || h || '(');
    END LOOP;
    IF newdef IS DISTINCT FROM def THEN
      EXECUTE newdef;
    END IF;
  END LOOP;
END
$do$;

-- 3. Lock down execution on the moved helpers: policies run as the querying role,
--    so authenticated still needs EXECUTE, but anon and PUBLIC do not.
DO $do$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'app_private'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END
$do$;