-- Fix concurrency gap in admin_set_user_role(): concurrent ADMIN -> STAFF
-- demotions could each read the active-admin count before either commits,
-- both pass validation, and leave zero ACTIVE ADMIN users. Lock ADMIN rows
-- with FOR UPDATE before counting, matching admin_set_user_status()'s
-- existing protection. All other authorization, validation, and audit
-- logging behavior is unchanged.
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
  PERFORM public.require_active_admin();

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
    -- Lock all ADMIN rows so a concurrent demotion of a different ADMIN
    -- must wait for this transaction to finish before it can (re)count
    -- active admins, preventing two simultaneous demotions from both
    -- succeeding and leaving zero active ADMIN users.
    PERFORM 1
    FROM public.users
    WHERE role = 'ADMIN'
    FOR UPDATE;

    SELECT count(*) INTO v_admin_count
    FROM public.users
    WHERE role = 'ADMIN' AND status = 'ACTIVE';

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

REVOKE ALL ON FUNCTION public.admin_set_user_role(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_user_role(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(text, text) TO authenticated;
