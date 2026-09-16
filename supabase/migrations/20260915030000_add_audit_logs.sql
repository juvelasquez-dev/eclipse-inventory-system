-- Audit Logs: records admin actions (role/area/status changes).
-- Additive and isolated — no existing tables, RLS, or Inventory/POS/Outlets
-- logic are modified. Frontend users cannot write to this table directly;
-- only the existing SECURITY DEFINER admin functions insert rows, using
-- the same elevated privileges they already have (table owner bypasses RLS).

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid,
  actor_username text,
  action text NOT NULL,
  target_user_id uuid,
  target_username text,
  details jsonb
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only ADMIN accounts may read audit logs; no INSERT/UPDATE/DELETE
-- policy exists for any client role, so writes can only happen via
-- SECURITY DEFINER functions (which bypass RLS as the table owner).
CREATE POLICY "Admins can read audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.get_current_user_role() = 'ADMIN');

REVOKE ALL ON TABLE public.audit_logs FROM anon, authenticated;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;


-- admin_set_user_role(): now writes a USER_ROLE_CHANGED audit log on
-- an actual change. All prior validation/authorization is unchanged.
CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  p_username text,
  p_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_current_role text;
  v_admin_count integer;
  v_target_email text;
  v_target_user_id uuid;
  v_actor_username text;
BEGIN
  IF public.get_current_user_role() IS DISTINCT FROM 'ADMIN' THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  IF p_role NOT IN ('ADMIN', 'STAFF') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  SELECT role, email INTO v_current_role, v_target_email
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

  IF v_current_role = p_role THEN
    RETURN;
  END IF;

  UPDATE public.users
  SET role = p_role
  WHERE username = p_username;

  SELECT username INTO v_actor_username
  FROM public.users
  WHERE lower(trim(email)) = lower(trim(auth.email()));

  SELECT id INTO v_target_user_id
  FROM auth.users
  WHERE lower(trim(email)) = lower(trim(v_target_email));

  INSERT INTO public.audit_logs (
    actor_user_id, actor_username, action,
    target_user_id, target_username, details
  ) VALUES (
    auth.uid(), v_actor_username, 'USER_ROLE_CHANGED',
    v_target_user_id, p_username,
    jsonb_build_object('old_role', v_current_role, 'new_role', p_role)
  );
END;
$function$;


-- admin_set_user_area(): now writes a USER_AREA_CHANGED audit log on
-- an actual change. All prior validation/authorization is unchanged.
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
  v_old_area text;
  v_actor_username text;
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

  SELECT area_code INTO v_old_area
  FROM public.user_area_assignments
  WHERE user_id = v_auth_user_id;

  IF v_old_area IS NOT DISTINCT FROM p_area_code THEN
    RETURN;
  END IF;

  INSERT INTO public.user_area_assignments (user_id, area_code)
  VALUES (v_auth_user_id, p_area_code)
  ON CONFLICT (user_id)
  DO UPDATE SET area_code = EXCLUDED.area_code;

  SELECT username INTO v_actor_username
  FROM public.users
  WHERE lower(trim(email)) = lower(trim(auth.email()));

  INSERT INTO public.audit_logs (
    actor_user_id, actor_username, action,
    target_user_id, target_username, details
  ) VALUES (
    auth.uid(), v_actor_username, 'USER_AREA_CHANGED',
    v_auth_user_id, p_username,
    jsonb_build_object('old_area', v_old_area, 'new_area', p_area_code)
  );
END;
$function$;


-- admin_set_user_status(): now writes a USER_STATUS_CHANGED audit log
-- on an actual change. All prior validation, self-deactivation and
-- concurrency-safe last-active-ADMIN protections are unchanged.
CREATE OR REPLACE FUNCTION public.admin_set_user_status(
  p_username text,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_caller_username text;
  v_target_role text;
  v_target_status text;
  v_target_email text;
  v_target_user_id uuid;
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

  SELECT role, status, email INTO v_target_role, v_target_status, v_target_email
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

  IF v_target_status = p_status THEN
    RETURN;
  END IF;

  UPDATE public.users
  SET status = p_status
  WHERE username = p_username;

  SELECT id INTO v_target_user_id
  FROM auth.users
  WHERE lower(trim(email)) = lower(trim(v_target_email));

  INSERT INTO public.audit_logs (
    actor_user_id, actor_username, action,
    target_user_id, target_username, details
  ) VALUES (
    auth.uid(), v_caller_username, 'USER_STATUS_CHANGED',
    v_target_user_id, p_username,
    jsonb_build_object('old_status', v_target_status, 'new_status', p_status)
  );
END;
$function$;
