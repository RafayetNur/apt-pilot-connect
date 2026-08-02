CREATE TYPE public.building_status AS ENUM ('active', 'inactive');

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text NOT NULL,
  area text NOT NULL DEFAULT '',
  floors integer NOT NULL DEFAULT 0 CHECK (floors >= 0),
  total_flats integer NOT NULL DEFAULT 0 CHECK (total_flats >= 0),
  assigned_manager text NOT NULL DEFAULT '',
  status public.building_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.buildings TO authenticated;
GRANT ALL ON public.buildings TO service_role;

ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own buildings" ON public.buildings
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id AND public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can insert own buildings" ON public.buildings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id AND public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can update own buildings" ON public.buildings
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id AND public.has_role(auth.uid(), 'owner'))
  WITH CHECK (auth.uid() = owner_id AND public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Owners can delete own buildings" ON public.buildings
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id AND public.has_role(auth.uid(), 'owner'));

CREATE INDEX buildings_owner_id_idx ON public.buildings(owner_id);

CREATE TRIGGER update_buildings_updated_at
  BEFORE UPDATE ON public.buildings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();