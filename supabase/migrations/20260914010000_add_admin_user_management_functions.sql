-- Admin-only user management RPCs.
-- Each function independently re-verifies the caller's role via
-- get_current_user_role() so authorization is enforced server-side,
-- not just hidden in the UI. No existing table grants or RLS policies
-- (Inventory/POS/Outlets/users/user_area_assignments) are modified.

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  username text,
  email text,
  role text,
  area_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
BEGIN
  IF public.get_current_user_role() IS DISTINCT FROM 'ADMIN' THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT
    u.username,
    u.email,
    u.role,
    uaa.area_code
  FROM public.users u
  LEFT JOIN auth.users au
    ON lower(trim(au.email)) = lower(trim(u.email))
  LEFT JOIN public.user_area_assignments uaa
    ON uaa.user_id = au.id
  ORDER BY u.username;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_users() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;


CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  p_username text,
  p_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_current_role text;
  v_admin_count integer;
BEGIN
  IF public.get_current_user_role() IS DISTINCT FROM 'ADMIN' THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  IF p_role NOT IN ('ADMIN', 'STAFF') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  SELECT role INTO v_current_role
  FROM public.users
  WHERE username = p_username;

  IF v_current_role IS NULL THEN
    RAISE EXCEPTION 'User not found: %', p_username;
  END IF;

  IF v_current_role = 'ADMIN' AND p_role = 'STAFF' THEN
    SELECT count(*) INTO v_admin_count
    FROM public.users
    WHERE role = 'ADMIN';

    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last ADMIN user.';
    END IF;
  END IF;

  UPDATE public.users
  SET role = p_role
  WHERE username = p_username;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_user_role(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_user_role(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(text, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.admin_set_user_area(
  p_username text,
  p_area_code text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_email text;
  v_auth_user_id uuid;
BEGIN
  IF public.get_current_user_role() IS DISTINCT FROM 'ADMIN' THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  IF p_area_code NOT IN ('IAO', 'CBR', 'EFT') THEN
    RAISE EXCEPTION 'Invalid area code: %', p_area_code;
  END IF;

  SELECT email INTO v_email
  FROM public.users
  WHERE username = p_username;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'User not found: %', p_username;
  END IF;

  SELECT id INTO v_auth_user_id
  FROM auth.users
  WHERE lower(trim(email)) = lower(trim(v_email));

  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth account found for user: %', p_username;
  END IF;

  INSERT INTO public.user_area_assignments (user_id, area_code)
  VALUES (v_auth_user_id, p_area_code)
  ON CONFLICT (user_id)
  DO UPDATE SET area_code = EXCLUDED.area_code;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_user_area(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_user_area(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_area(text, text) TO authenticated;
