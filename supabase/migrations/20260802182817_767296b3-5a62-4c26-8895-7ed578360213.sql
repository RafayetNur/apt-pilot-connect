CREATE TYPE public.occupancy_status AS ENUM ('vacant', 'occupied');

CREATE TABLE public.flats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  flat_number text NOT NULL,
  floor_number integer NOT NULL DEFAULT 0,
  bedroom_count integer NOT NULL DEFAULT 0,
  bathroom_count integer NOT NULL DEFAULT 0,
  size_sqft integer NOT NULL DEFAULT 0,
  monthly_rent numeric(12,2) NOT NULL DEFAULT 0,
  occupancy_status public.occupancy_status NOT NULL DEFAULT 'vacant',
  tenant_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT flats_flat_number_not_blank CHECK (btrim(flat_number) <> ''),
  CONSTRAINT flats_monthly_rent_non_negative CHECK (monthly_rent >= 0),
  CONSTRAINT flats_unique_number_per_building UNIQUE (building_id, flat_number)
);

CREATE INDEX flats_building_id_idx ON public.flats(building_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.flats TO authenticated;
GRANT ALL ON public.flats TO service_role;

ALTER TABLE public.flats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view flats in own buildings"
ON public.flats FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.buildings b
  WHERE b.id = flats.building_id
    AND b.owner_id = auth.uid()
    AND public.has_role(auth.uid(), 'owner')
));

CREATE POLICY "Owners can insert flats in own buildings"
ON public.flats FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.buildings b
  WHERE b.id = flats.building_id
    AND b.owner_id = auth.uid()
    AND public.has_role(auth.uid(), 'owner')
));

CREATE POLICY "Owners can update flats in own buildings"
ON public.flats FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.buildings b
  WHERE b.id = flats.building_id
    AND b.owner_id = auth.uid()
    AND public.has_role(auth.uid(), 'owner')
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.buildings b
  WHERE b.id = flats.building_id
    AND b.owner_id = auth.uid()
    AND public.has_role(auth.uid(), 'owner')
));

CREATE POLICY "Owners can delete flats in own buildings"
ON public.flats FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.buildings b
  WHERE b.id = flats.building_id
    AND b.owner_id = auth.uid()
    AND public.has_role(auth.uid(), 'owner')
));

CREATE POLICY "Managers can view flats of assigned buildings"
ON public.flats FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'manager')
  AND EXISTS (
    SELECT 1
    FROM public.buildings b
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE b.id = flats.building_id
      AND btrim(b.assigned_manager) <> ''
      AND (
        lower(btrim(b.assigned_manager)) = lower(btrim(p.email))
        OR lower(btrim(b.assigned_manager)) = lower(btrim(p.full_name))
      )
  )
);

CREATE TRIGGER flats_set_updated_at
BEFORE UPDATE ON public.flats
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();