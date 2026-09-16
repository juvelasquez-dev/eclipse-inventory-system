-- Returns the role of the currently authenticated user from public.users.
-- SECURITY DEFINER so the frontend does not need a broad SELECT policy on public.users.
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT role
  FROM public.users
  WHERE lower(trim(email)) = lower(trim(auth.email()));
$function$;

REVOKE ALL ON FUNCTION public.get_current_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_current_user_role() FROM anon;

GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;
