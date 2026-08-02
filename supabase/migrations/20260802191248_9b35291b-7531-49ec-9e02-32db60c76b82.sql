CREATE TYPE public.payment_status AS ENUM ('unpaid', 'paid', 'overdue');

CREATE TABLE public.rent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  flat_id uuid NOT NULL REFERENCES public.flats(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  billing_month date NOT NULL,
  base_rent numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rent_records_unique_flat_month UNIQUE (flat_id, billing_month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rent_records TO authenticated;
GRANT ALL ON public.rent_records TO service_role;

ALTER TABLE public.rent_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view rent of own buildings" ON public.rent_records
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.buildings b WHERE b.id = rent_records.building_id AND b.owner_id = auth.uid() AND public.has_role(auth.uid(), 'owner'::public.app_role)));

CREATE POLICY "Owners can insert rent for own buildings" ON public.rent_records
FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND EXISTS (SELECT 1 FROM public.buildings b WHERE b.id = rent_records.building_id AND b.owner_id = auth.uid() AND public.has_role(auth.uid(), 'owner'::public.app_role)));

CREATE POLICY "Owners can update rent of own buildings" ON public.rent_records
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.buildings b WHERE b.id = rent_records.building_id AND b.owner_id = auth.uid() AND public.has_role(auth.uid(), 'owner'::public.app_role)))
WITH CHECK (EXISTS (SELECT 1 FROM public.buildings b WHERE b.id = rent_records.building_id AND b.owner_id = auth.uid() AND public.has_role(auth.uid(), 'owner'::public.app_role)));

CREATE POLICY "Owners can delete rent of own buildings" ON public.rent_records
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.buildings b WHERE b.id = rent_records.building_id AND b.owner_id = auth.uid() AND public.has_role(auth.uid(), 'owner'::public.app_role)));

CREATE POLICY "Tenants can view own rent records" ON public.rent_records
FOR SELECT TO authenticated
USING (tenant_id = auth.uid() AND public.has_role(auth.uid(), 'tenant'::public.app_role));

CREATE POLICY "Managers can view rent of assigned buildings" ON public.rent_records
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'manager'::public.app_role) AND EXISTS (
  SELECT 1 FROM public.buildings b JOIN public.profiles p ON p.id = auth.uid()
  WHERE b.id = rent_records.building_id AND btrim(b.assigned_manager) <> ''
    AND (lower(btrim(b.assigned_manager)) = lower(btrim(p.email)) OR lower(btrim(b.assigned_manager)) = lower(btrim(p.full_name)))
));

CREATE TRIGGER rent_records_set_updated_at
BEFORE UPDATE ON public.rent_records
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();