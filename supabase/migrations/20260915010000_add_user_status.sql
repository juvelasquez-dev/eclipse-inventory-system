-- Adds Active/Inactive account status to public.users, plus admin-gated RPCs.
-- Supabase Auth (login/password) is untouched — status is enforced entirely
-- at the application layer (Login.tsx / ProtectedRoute.tsx), consistent with
-- how `role` is already handled (no RLS/Auth-level enforcement).

ALTER TABLE public.users
  ADD COLUMN status text NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE public.users
  ADD CONSTRAINT users_status_check
  CHECK (status IN ('ACTIVE', 'INACTIVE'));


-- Returns the status of the currently authenticated user from public.users.
CREATE OR REPLACE FUNCTION public.get_current_user_status()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT status
  FROM public.users
  WHERE lower(trim(email)) = lower(trim(auth.email()));
$function$;

REVOKE ALL ON FUNCTION public.get_current_user_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_current_user_status() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_current_user_status() TO authenticated;


-- admin_list_users() now also returns status. Its return row shape is
-- changing (a new output column), which Postgres does not allow via
-- CREATE OR REPLACE alone, so the existing function must be dropped first.
DROP FUNCTION IF EXISTS public.admin_list_users();

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  username text,
  email text,
  role text,
  status text,
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
    u.status,
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


-- admin_set_user_status(): activate/deactivate a user.
-- Guards: caller must be ADMIN; cannot deactivate own account;
-- cannot deactivate the last remaining ACTIVE ADMIN.
CREATE OR REPLACE FUNCTION public.admin_set_user_status(
  p_username text,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller_username text;
  v_target_role text;
  v_target_status text;
  v_active_admin_count integer;
BEGIN
  IF public.get_current_user_role() IS DISTINCT FROM 'ADMIN' THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  IF p_status NOT IN ('ACTIVE', 'INACTIVE') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  SELECT username INTO v_caller_username
  FROM public.users
  WHERE lower(trim(email)) = lower(trim(auth.email()));

  IF v_caller_username IS NOT NULL
     AND v_caller_username = p_username
     AND p_status = 'INACTIVE' THEN
    RAISE EXCEPTION 'You cannot deactivate your own account.';
  END IF;

  SELECT role, status INTO v_target_role, v_target_status
  FROM public.users
  WHERE username = p_username;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'User not found: %', p_username;
  END IF;

  IF v_target_role = 'ADMIN'
     AND v_target_status = 'ACTIVE'
     AND p_status = 'INACTIVE' THEN

    -- Lock all ADMIN rows so a concurrent admin_set_user_status call
    -- deactivating a different ADMIN must wait for this transaction to
    -- finish before it can (re)count active admins. Without this, two
    -- simultaneous deactivations could each see count > 1 and both
    -- succeed, leaving zero active ADMIN users.
    PERFORM 1
    FROM public.users
    WHERE role = 'ADMIN'
    FOR UPDATE;

    SELECT count(*) INTO v_active_admin_count
    FROM public.users
    WHERE role = 'ADMIN' AND status = 'ACTIVE';

    IF v_active_admin_count <= 1 THEN
      RAISE EXCEPTION 'Cannot deactivate the last remaining active ADMIN user.';
    END IF;
  END IF;

  UPDATE public.users
  SET status = p_status
  WHERE username = p_username;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_user_status(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_user_status(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status(text, text) TO authenticated;
