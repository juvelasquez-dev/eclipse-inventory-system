CREATE TABLE public.outlet_change_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id uuid REFERENCES public.outlets(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('CREATED', 'UPDATED')),
  changed_fields jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(changed_fields) = 'object'),
  actor_user_id uuid,
  actor_username text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX outlet_change_logs_outlet_created_at_idx
  ON public.outlet_change_logs (outlet_id, created_at DESC);

ALTER TABLE public.outlet_change_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.outlet_change_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.outlet_change_logs TO authenticated;

CREATE POLICY "Active users can view outlet change history"
ON public.outlet_change_logs
FOR SELECT
TO authenticated
USING (public.get_current_user_status() = 'ACTIVE');

CREATE OR REPLACE FUNCTION public.record_outlet_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_changed_fields jsonb := '{}'::jsonb;
  v_actor_username text;
BEGIN
  v_actor_username := public.get_current_username();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.outlet_change_logs (
      outlet_id, action, changed_fields, actor_user_id, actor_username
    ) VALUES (
      NEW.id, 'CREATED', '{}'::jsonb, auth.uid(), v_actor_username
    );

    RETURN NEW;
  END IF;

  IF OLD.outlet_name IS DISTINCT FROM NEW.outlet_name THEN
    v_changed_fields := v_changed_fields || jsonb_build_object(
      'outlet_name', jsonb_build_object('old', OLD.outlet_name, 'new', NEW.outlet_name)
    );
  END IF;
  IF OLD.contact_person IS DISTINCT FROM NEW.contact_person THEN
    v_changed_fields := v_changed_fields || jsonb_build_object(
      'contact_person', jsonb_build_object('old', OLD.contact_person, 'new', NEW.contact_person)
    );
  END IF;
  IF OLD.contact_number IS DISTINCT FROM NEW.contact_number THEN
    v_changed_fields := v_changed_fields || jsonb_build_object(
      'contact_number', jsonb_build_object('old', OLD.contact_number, 'new', NEW.contact_number)
    );
  END IF;
  IF OLD.complete_address IS DISTINCT FROM NEW.complete_address THEN
    v_changed_fields := v_changed_fields || jsonb_build_object(
      'complete_address', jsonb_build_object('old', OLD.complete_address, 'new', NEW.complete_address)
    );
  END IF;
  IF OLD.area_code IS DISTINCT FROM NEW.area_code THEN
    v_changed_fields := v_changed_fields || jsonb_build_object(
      'area_code', jsonb_build_object('old', OLD.area_code, 'new', NEW.area_code)
    );
  END IF;
  IF OLD.degic_number IS DISTINCT FROM NEW.degic_number THEN
    v_changed_fields := v_changed_fields || jsonb_build_object(
      'degic_number', jsonb_build_object('old', OLD.degic_number, 'new', NEW.degic_number)
    );
  END IF;
  IF OLD.tin IS DISTINCT FROM NEW.tin THEN
    v_changed_fields := v_changed_fields || jsonb_build_object(
      'tin', jsonb_build_object('old', OLD.tin, 'new', NEW.tin)
    );
  END IF;
  IF OLD.id_type IS DISTINCT FROM NEW.id_type THEN
    v_changed_fields := v_changed_fields || jsonb_build_object(
      'id_type', jsonb_build_object('old', OLD.id_type, 'new', NEW.id_type)
    );
  END IF;
  IF OLD.id_number IS DISTINCT FROM NEW.id_number THEN
    v_changed_fields := v_changed_fields || jsonb_build_object(
      'id_number', jsonb_build_object('old', OLD.id_number, 'new', NEW.id_number)
    );
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_changed_fields := v_changed_fields || jsonb_build_object(
      'status', jsonb_build_object('old', OLD.status, 'new', NEW.status)
    );
  END IF;

  IF v_changed_fields = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.outlet_change_logs (
    outlet_id, action, changed_fields, actor_user_id, actor_username
  ) VALUES (
    NEW.id, 'UPDATED', v_changed_fields, auth.uid(), v_actor_username
  );

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_outlet_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_outlet_change() FROM anon;
REVOKE ALL ON FUNCTION public.record_outlet_change() FROM authenticated;

CREATE TRIGGER outlets_record_created
AFTER INSERT ON public.outlets
FOR EACH ROW
EXECUTE FUNCTION public.record_outlet_change();

CREATE TRIGGER outlets_record_updated
AFTER UPDATE ON public.outlets
FOR EACH ROW
EXECUTE FUNCTION public.record_outlet_change();
