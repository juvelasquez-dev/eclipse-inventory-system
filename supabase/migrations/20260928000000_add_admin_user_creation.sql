-- Creates an application user profile, area assignment, and audit event in
-- one transaction after the Edge Function creates the corresponding Auth user.
CREATE OR REPLACE FUNCTION public.admin_create_user_profile(
  p_actor_auth_user_id uuid,
  p_auth_user_id uuid,
  p_username text,
  p_role text,
  p_status text,
  p_area_code text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_auth_email text;
  v_actor_username text;
  v_public_user_id uuid;
BEGIN
  IF p_actor_auth_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Admin actor is required';
  END IF;

  SELECT u.username
  INTO v_actor_username
  FROM auth.users actor
  JOIN public.users u
    ON lower(trim(u.email)) = lower(trim(actor.email))
  WHERE actor.id = p_actor_auth_user_id
    AND u.role = 'ADMIN'
    AND u.status = 'ACTIVE';

  IF v_actor_username IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Active admin actor not found';
  END IF;

  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Auth user is required';
  END IF;

  IF p_username IS NULL OR btrim(p_username) = '' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Username is required';
  END IF;

  IF p_role IS NULL OR p_role NOT IN ('ADMIN', 'STAFF') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Invalid role';
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('ACTIVE', 'INACTIVE') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Invalid status';
  END IF;

  IF p_area_code IS NULL OR p_area_code NOT IN ('IAO', 'CBR', 'EFT') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Invalid area';
  END IF;

  SELECT au.email
  INTO v_auth_email
  FROM auth.users au
  WHERE au.id = p_auth_user_id;

  IF v_auth_email IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Auth user not found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.username = p_username
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Username already exists';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.users u
    WHERE lower(trim(u.email)) = lower(trim(v_auth_email))
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Email already has a user profile';
  END IF;

  -- This fixed non-secret sentinel only satisfies the legacy NOT NULL column.
  INSERT INTO public.users (username, email, role, status, password)
  VALUES (
    p_username,
    v_auth_email,
    p_role,
    p_status,
    'LEGACY_AUTH_PASSWORD_UNUSED'
  )
  RETURNING id INTO v_public_user_id;

  INSERT INTO public.user_area_assignments (user_id, area_code)
  VALUES (p_auth_user_id, p_area_code);

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
    'USER_CREATED',
    v_public_user_id,
    p_username,
    jsonb_build_object(
      'role', p_role,
      'status', p_status,
      'area', p_area_code,
      'email', v_auth_email
    )
  );

  RETURN v_public_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_create_user_profile(uuid, uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_create_user_profile(uuid, uuid, text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.admin_create_user_profile(uuid, uuid, text, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_user_profile(uuid, uuid, text, text, text, text) TO service_role;