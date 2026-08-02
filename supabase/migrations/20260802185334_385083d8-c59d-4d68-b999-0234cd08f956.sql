CREATE OR REPLACE FUNCTION public.can_view_building(building_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
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
  OR EXISTS (
    SELECT 1
    FROM public.flats f
    JOIN public.profiles p ON p.id = user_uuid
    WHERE f.building_id = building_uuid
      AND f.tenant_id = user_uuid
      AND p.role = 'tenant'::public.app_role
  )
$$;

REVOKE ALL ON FUNCTION public.can_view_building(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_building(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_view_building(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_building(uuid, uuid) TO service_role;

DROP POLICY IF EXISTS "Tenants can view building of assigned flat" ON public.buildings;
DROP POLICY IF EXISTS "Owners can view own buildings" ON public.buildings;

CREATE POLICY "Permitted users can view buildings"
ON public.buildings
FOR SELECT
TO authenticated
USING (public.can_view_building(id, auth.uid()));