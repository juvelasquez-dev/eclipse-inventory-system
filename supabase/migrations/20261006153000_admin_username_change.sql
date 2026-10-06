ALTER TABLE public.users
  ADD CONSTRAINT users_username_not_blank
  CHECK (username ~ '[^[:space:]]');

CREATE UNIQUE INDEX users_username_normalized_key
  ON public.users (lower(btrim(username)));

DROP FUNCTION public.admin_list_users();

CREATE FUNCTION public.admin_list_users()
RETURNS TABLE (
  username text,
  email text,
  role text,
  status text,
  area_code text,
  profile_id uuid
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
    uaa.area_code,
    u.id
  FROM public.users AS u
  LEFT JOIN auth.users AS au
    ON lower(btrim(au.email)) = lower(btrim(u.email))
  LEFT JOIN public.user_area_assignments AS uaa
    ON uaa.user_id = au.id
  ORDER BY u.username;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_users() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_change_username(
  p_target_profile_id uuid,
  p_expected_username text,
  p_new_username text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_old_username text;
  v_target_email text;
  v_target_auth_user_id uuid;
  v_target_auth_count integer;
  v_target_profile_count integer;
  v_actor_username text;
  v_actor_profile_count integer;
  v_new_username text;
BEGIN
  PERFORM public.require_active_admin();

  IF p_target_profile_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'User could not be verified.';
  END IF;

  SELECT u.username, u.email
  INTO v_old_username, v_target_email
  FROM public.users AS u
  WHERE u.id = p_target_profile_id
  FOR UPDATE;

  IF v_old_username IS NULL OR v_target_email IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'User could not be verified.';
  END IF;

  SELECT count(*)
  INTO v_target_profile_count
  FROM public.users AS u
  WHERE lower(btrim(u.email)) = lower(btrim(v_target_email));

  IF v_target_profile_count <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'User could not be verified.';
  END IF;

  IF p_expected_username IS DISTINCT FROM v_old_username THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'This username has changed. Refresh the user list and try again.';
  END IF;

  v_new_username := regexp_replace(
    p_new_username,
    '^[[:space:]]+|[[:space:]]+$',
    '',
    'g'
  );

  IF v_new_username IS NULL OR v_new_username !~ '[^[:space:]]' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Username cannot be blank.';
  END IF;

  SELECT count(*), min(au.id::text)::uuid
  INTO v_target_auth_count, v_target_auth_user_id
  FROM auth.users AS au
  WHERE au.email IS NOT NULL
    AND lower(btrim(au.email)) = lower(btrim(v_target_email));

  IF v_target_auth_count <> 1 OR v_target_auth_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'User could not be verified.';
  END IF;

  IF v_target_auth_user_id = auth.uid() THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'You cannot change your own username.';
  END IF;

  SELECT count(*), min(u.username)
  INTO v_actor_profile_count, v_actor_username
  FROM auth.users AS au
  JOIN public.users AS u
    ON lower(btrim(u.email)) = lower(btrim(au.email))
  WHERE au.id = auth.uid()
    AND u.role = 'ADMIN'
    AND u.status = 'ACTIVE';

  IF v_actor_profile_count <> 1 OR v_actor_username IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Active admin account could not be verified.';
  END IF;

  IF v_new_username = v_old_username THEN
    RETURN;
  END IF;

  BEGIN
    UPDATE public.users
    SET username = v_new_username
    WHERE id = p_target_profile_id;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'That username is already in use.';
  END;

  INSERT INTO public.audit_logs (
    actor_user_id,
    actor_username,
    action,
    target_user_id,
    target_username,
    details
  ) VALUES (
    auth.uid(),
    v_actor_username,
    'USERNAME_CHANGED',
    v_target_auth_user_id,
    v_new_username,
    jsonb_build_object(
      'old_username', v_old_username,
      'new_username', v_new_username
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_change_username(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_change_username(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_change_username(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_username_exists(p_username text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.users AS u
    WHERE lower(btrim(u.username)) = lower(btrim(p_username))
  );
$function$;

REVOKE ALL ON FUNCTION public.admin_username_exists(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_username_exists(text) FROM anon;
REVOKE ALL ON FUNCTION public.admin_username_exists(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_username_exists(text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_current_username()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_profile_count integer;
  v_username text;
BEGIN
  SELECT count(*), min(u.username)
  INTO v_profile_count, v_username
  FROM auth.users AS au
  JOIN public.users AS u
    ON lower(btrim(u.email)) = lower(btrim(au.email))
  WHERE au.id = auth.uid();

  IF v_profile_count <> 1 THEN
    RETURN NULL;
  END IF;

  RETURN v_username;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_current_username() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_current_username() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_current_username() TO authenticated;

NOTIFY pgrst, 'reload schema';
