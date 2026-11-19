BEGIN;

CREATE OR REPLACE FUNCTION public.reject_inactive_pos_transaction_outlet()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_outlet_status text;
BEGIN
  IF NEW.outlet_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT o.status
  INTO v_outlet_status
  FROM public.outlets AS o
  WHERE o.id = NEW.outlet_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected outlet does not exist: %', NEW.outlet_id;
  END IF;

  IF v_outlet_status IS DISTINCT FROM 'Active' THEN
    RAISE EXCEPTION 'Selected outlet is inactive: %', NEW.outlet_id;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.reject_inactive_pos_transaction_outlet()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER pos_transactions_require_active_outlet
BEFORE INSERT ON public.pos_transactions
FOR EACH ROW
EXECUTE FUNCTION public.reject_inactive_pos_transaction_outlet();

COMMIT;
