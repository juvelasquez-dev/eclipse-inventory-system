CREATE OR REPLACE FUNCTION public.admin_resolve_password_reset_target(
  p_username text
)
RETURNS TABLE (
  auth_user_id uuid,
  username text,
  role text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_profile_email text;
  v_role text;
  v_status text;
  v_profile_count integer;
  v_auth_count integer;
  v_auth_user_id uuid;
BEGIN
  IF p_username IS NULL OR btrim(p_username) = '' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Target account could not be verified';
  END IF;

  SELECT count(*)
  INTO v_profile_count
  FROM public.users AS u
  WHERE u.username = p_username;

  IF v_profile_count <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Target account could not be verified';
  END IF;

  SELECT u.email, u.role, u.status
  INTO v_profile_email, v_role, v_status
  FROM public.users AS u
  WHERE u.username = p_username;

  IF v_profile_email IS NULL OR btrim(v_profile_email) = '' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Target account could not be verified';
  END IF;

  SELECT count(*)
  INTO v_profile_count
  FROM public.users AS u
  WHERE lower(btrim(u.email)) = lower(btrim(v_profile_email));

  SELECT count(*), min(au.id::text)::uuid
  INTO v_auth_count, v_auth_user_id
  FROM auth.users AS au
  WHERE au.email IS NOT NULL
    AND lower(btrim(au.email)) = lower(btrim(v_profile_email));

  IF v_profile_count <> 1 OR v_auth_count <> 1 OR v_auth_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Target account could not be verified';
  END IF;

  RETURN QUERY
  SELECT v_auth_user_id, p_username, v_role, v_status;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_resolve_password_reset_target(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_resolve_password_reset_target(text) FROM anon;
REVOKE ALL ON FUNCTION public.admin_resolve_password_reset_target(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_password_reset_target(text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_log_password_reset(
  p_actor_auth_user_id uuid,
  p_target_auth_user_id uuid,
  p_target_username text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_actor_username text;
  v_actor_count integer;
  v_target_email text;
  v_target_role text;
  v_target_status text;
  v_target_count integer;
BEGIN
  SELECT count(*), min(u.username)
  INTO v_actor_count, v_actor_username
  FROM auth.users AS actor
  JOIN public.users AS u
    ON lower(btrim(u.email)) = lower(btrim(actor.email))
  WHERE actor.id = p_actor_auth_user_id
    AND u.role = 'ADMIN'
    AND u.status = 'ACTIVE';

  IF v_actor_count <> 1 OR v_actor_username IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Active admin actor could not be verified';
  END IF;

  SELECT count(*), min(u.email), min(u.role), min(u.status)
  INTO v_target_count, v_target_email, v_target_role, v_target_status
  FROM public.users AS u
  JOIN auth.users AS target
    ON lower(btrim(target.email)) = lower(btrim(u.email))
  WHERE target.id = p_target_auth_user_id
    AND u.username = p_target_username;

  IF v_target_count <> 1 OR v_target_email IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Target account could not be verified';
  END IF;

  INSERT INTO public.audit_logs (
    actor_user_id,
    actor_username,
    action,
    target_user_id,
    target_username,
    details
  ) VALUES (
    p_actor_auth_user_id,
    v_actor_username,
    'PASSWORD_RESET_BY_ADMIN',
    p_target_auth_user_id,
    p_target_username,
    jsonb_build_object(
      'target_role', v_target_role,
      'target_status', v_target_status
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_log_password_reset(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_log_password_reset(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.admin_log_password_reset(uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_log_password_reset(uuid, uuid, text) TO service_role;
