-- Owners and managers may look up tenant profiles (needed for assignment + display)
CREATE POLICY "Owners and managers can view tenant profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  role = 'tenant'::public.app_role
  AND (
    public.has_role(auth.uid(), 'owner'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  )
);

-- Tenants may view only the flat assigned to them
CREATE POLICY "Tenants can view own assigned flat"
ON public.flats
FOR SELECT
TO authenticated
USING (
  tenant_id = auth.uid()
  AND public.has_role(auth.uid(), 'tenant'::public.app_role)
);

-- Tenants may view the building of their assigned flat
CREATE POLICY "Tenants can view building of assigned flat"
ON public.buildings
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'tenant'::public.app_role)
  AND EXISTS (
    SELECT 1 FROM public.flats f
    WHERE f.building_id = buildings.id
      AND f.tenant_id = auth.uid()
  )
);