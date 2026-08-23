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
  IF meta_role IN ('owner','manager','tenant') THEN
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (id, full_name, email, phone, role)
SELECT
  u.id,
  COALESCE(NULLIF(TRIM(u.raw_user_meta_data ->> 'full_name'), ''), split_part(COALESCE(u.email, 'Member'), '@', 1)),
  COALESCE(u.email, ''),
  COALESCE(NULLIF(TRIM(u.raw_user_meta_data ->> 'phone'), ''), ''),
  CASE WHEN u.raw_user_meta_data ->> 'role' IN ('owner','manager','tenant')
       THEN (u.raw_user_meta_data ->> 'role')::public.app_role
       ELSE 'tenant'::public.app_role END
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;