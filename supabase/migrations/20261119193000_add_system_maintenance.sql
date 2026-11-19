CREATE TABLE public.system_maintenance_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  announcement text NOT NULL DEFAULT '' CHECK (char_length(announcement) <= 500),
  expected_end_at timestamptz,
  version integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_by_username text
);

ALTER TABLE public.system_maintenance_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.system_maintenance_settings FROM PUBLIC, anon, authenticated;

INSERT INTO public.system_maintenance_settings (singleton) VALUES (true);

CREATE FUNCTION public.get_system_maintenance()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT jsonb_build_object(
    'enabled', enabled,
    'announcement', announcement,
    'expected_end_at', expected_end_at
  )
  FROM public.system_maintenance_settings
  WHERE singleton = true;
$function$;

CREATE FUNCTION public.admin_get_system_maintenance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  PERFORM public.require_active_admin();
  SELECT jsonb_build_object(
    'enabled', enabled,
    'announcement', announcement,
    'expected_end_at', expected_end_at,
    'version', version,
    'updated_at', updated_at,
    'updated_by_username', updated_by_username
  ) INTO STRICT v_result
  FROM public.system_maintenance_settings
  WHERE singleton = true;
  RETURN v_result;
END;
$function$;

CREATE FUNCTION public.admin_update_system_maintenance(
  p_enabled boolean,
  p_announcement text,
  p_expected_end_at timestamptz,
  p_version integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_previous public.system_maintenance_settings%ROWTYPE;
  v_actor_username text;
  v_action text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  PERFORM public.require_active_admin();

  IF p_enabled IS NULL OR p_announcement IS NULL OR char_length(p_announcement) > 500
     OR (p_expected_end_at IS NOT NULL AND (
       NOT isfinite(p_expected_end_at)
       OR p_expected_end_at < '1000-01-01 00:00:00+08'::timestamptz
       OR p_expected_end_at >= '10000-01-01 00:00:00+08'::timestamptz
     )) OR p_version IS NULL THEN
    RAISE EXCEPTION 'Invalid maintenance settings';
  END IF;

  SELECT * INTO STRICT v_previous
  FROM public.system_maintenance_settings
  WHERE singleton = true
  FOR UPDATE;

  IF v_previous.version <> p_version THEN
    RAISE EXCEPTION 'Maintenance settings changed; reload before saving';
  END IF;

  IF v_previous.enabled IS NOT DISTINCT FROM p_enabled
     AND v_previous.announcement IS NOT DISTINCT FROM p_announcement
     AND v_previous.expected_end_at IS NOT DISTINCT FROM p_expected_end_at THEN
    RETURN;
  END IF;

  SELECT username INTO v_actor_username
  FROM public.users
  WHERE lower(trim(email)) = lower(trim(auth.email()));

  UPDATE public.system_maintenance_settings
  SET enabled = p_enabled,
      announcement = p_announcement,
      expected_end_at = p_expected_end_at,
      version = version + 1,
      updated_at = now(),
      updated_by = auth.uid(),
      updated_by_username = v_actor_username
  WHERE singleton = true;

  v_action := CASE
    WHEN v_previous.enabled IS DISTINCT FROM p_enabled AND p_enabled THEN 'MAINTENANCE_ENABLED'
    WHEN v_previous.enabled IS DISTINCT FROM p_enabled THEN 'MAINTENANCE_DISABLED'
    ELSE 'MAINTENANCE_UPDATED'
  END;

  INSERT INTO public.audit_logs (actor_user_id, actor_username, action, details)
  VALUES (
    auth.uid(), v_actor_username, v_action,
    jsonb_build_object(
      'old_enabled', v_previous.enabled,
      'new_enabled', p_enabled,
      'old_announcement', v_previous.announcement,
      'new_announcement', p_announcement,
      'old_expected_end_at', v_previous.expected_end_at,
      'new_expected_end_at', p_expected_end_at
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_system_maintenance() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_system_maintenance() TO anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_get_system_maintenance() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_system_maintenance() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_update_system_maintenance(boolean, text, timestamptz, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_system_maintenance(boolean, text, timestamptz, integer) TO authenticated;
