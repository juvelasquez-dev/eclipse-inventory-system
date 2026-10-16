-- POS revisions, lifecycle history, and atomic cancel/modify operations.
-- Apply only after reviewing the pending migration history for the target environment.

ALTER TABLE public.pos_transactions
  ADD COLUMN IF NOT EXISTS revision_number integer NOT NULL DEFAULT 1;

CREATE TABLE public.pos_transaction_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id text NOT NULL
    REFERENCES public.pos_transactions(id) ON DELETE RESTRICT,
  revision_number integer NOT NULL CHECK (revision_number > 0),
  snapshot jsonb NOT NULL,
  actor_user_id uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_transaction_revisions_transaction_revision_key
    UNIQUE (transaction_id, revision_number),
  CONSTRAINT pos_transaction_revisions_id_transaction_key
    UNIQUE (id, transaction_id)
);

CREATE TABLE public.pos_transaction_requests (
  request_id uuid PRIMARY KEY,
  transaction_id text NOT NULL
    REFERENCES public.pos_transactions(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (action IN ('CANCEL', 'MODIFY', 'CHECKOUT')),
  request_payload jsonb NOT NULL,
  response jsonb,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pos_transaction_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id text NOT NULL
    REFERENCES public.pos_transactions(id) ON DELETE RESTRICT,
  event_type text NOT NULL
    CHECK (event_type IN ('BASELINE', 'CREATED', 'MODIFIED', 'CANCELLED', 'REOPENED')),
  revision_number integer NOT NULL CHECK (revision_number > 0),
  from_status text,
  to_status text NOT NULL,
  actor_user_id uuid,
  request_id uuid REFERENCES public.pos_transaction_requests(request_id) ON DELETE RESTRICT,
  reason text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_transaction_events_id_transaction_key
    UNIQUE (id, transaction_id),
  CONSTRAINT pos_transaction_events_revision_fkey
    FOREIGN KEY (transaction_id, revision_number)
    REFERENCES public.pos_transaction_revisions(transaction_id, revision_number)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX pos_transaction_events_transaction_created_idx
  ON public.pos_transaction_events (transaction_id, created_at, id);

ALTER TABLE public.transactions
  ADD COLUMN pos_transaction_id text,
  ADD COLUMN pos_revision integer,
  ADD COLUMN pos_event_id uuid,
  ADD CONSTRAINT transactions_pos_link_consistency_check
    CHECK (
      (pos_transaction_id IS NULL AND pos_revision IS NULL AND pos_event_id IS NULL)
      OR
      (pos_transaction_id IS NOT NULL AND pos_revision IS NOT NULL AND pos_event_id IS NOT NULL)
    ),
  ADD CONSTRAINT transactions_pos_revision_fkey
    FOREIGN KEY (pos_transaction_id, pos_revision)
    REFERENCES public.pos_transaction_revisions(transaction_id, revision_number)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT transactions_pos_event_fkey
    FOREIGN KEY (pos_event_id, pos_transaction_id)
    REFERENCES public.pos_transaction_events(id, transaction_id)
    ON DELETE RESTRICT;

CREATE INDEX transactions_pos_transaction_id_idx
  ON public.transactions (pos_transaction_id)
  WHERE pos_transaction_id IS NOT NULL;

ALTER TABLE public.pos_transaction_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_transaction_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_transaction_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.pos_transaction_revisions FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.pos_transaction_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.pos_transaction_events FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pos_transaction_snapshot(p_transaction_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT jsonb_build_object(
    'transaction', to_jsonb(pt),
    'items', coalesce((
      SELECT jsonb_agg(to_jsonb(pti) ORDER BY pti.product_id)
      FROM public.pos_transaction_items AS pti
      WHERE pti.transaction_id = pt.id
    ), '[]'::jsonb)
  )
  FROM public.pos_transactions AS pt
  WHERE pt.id = p_transaction_id;
$function$;

REVOKE ALL ON FUNCTION public.pos_transaction_snapshot(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reject_pos_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RAISE EXCEPTION 'POS revision and lifecycle history is immutable';
END;
$function$;

REVOKE ALL ON FUNCTION public.reject_pos_audit_mutation() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER pos_transaction_revisions_immutable
BEFORE UPDATE OR DELETE ON public.pos_transaction_revisions
FOR EACH ROW EXECUTE FUNCTION public.reject_pos_audit_mutation();

CREATE TRIGGER pos_transaction_events_immutable
BEFORE UPDATE OR DELETE ON public.pos_transaction_events
FOR EACH ROW EXECUTE FUNCTION public.reject_pos_audit_mutation();

INSERT INTO public.pos_transaction_revisions (
  transaction_id, revision_number, snapshot, actor_user_id, reason, created_at
)
SELECT
  pt.id,
  pt.revision_number,
  public.pos_transaction_snapshot(pt.id),
  NULL,
  'Migration baseline; earlier revision history is unavailable',
  now()
FROM public.pos_transactions AS pt
ON CONFLICT (transaction_id, revision_number) DO NOTHING;

INSERT INTO public.pos_transaction_events (
  transaction_id, event_type, revision_number, from_status, to_status,
  actor_user_id, details, created_at
)
SELECT
  pt.id, 'BASELINE', pt.revision_number, NULL, pt.transaction_status,
  NULL, jsonb_build_object('migration_backfill', true), now()
FROM public.pos_transactions AS pt
WHERE NOT EXISTS (
  SELECT 1 FROM public.pos_transaction_events AS e
  WHERE e.transaction_id = pt.id AND e.event_type = 'BASELINE'
);

CREATE OR REPLACE FUNCTION public.create_pos_transaction_for_area(
  p_customer_name text DEFAULT ''::text,
  p_customer_address text DEFAULT ''::text,
  p_customer_phone text DEFAULT ''::text,
  p_amount_received numeric DEFAULT 0,
  p_payment_method text DEFAULT 'CASH'::text,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_area_code text DEFAULT NULL,
  p_request_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  item record;
  product_row record;
  product_id_value text;
  current_stock bigint;
  subtotal_amount numeric(12, 2) := 0;
  total_quantity bigint := 0;
  change_amount numeric(12, 2);
  receipt_number bigint;
  v_receipt_year integer;
  transaction_id uuid;
  area_code_value text;
  display_receipt_number text;
  v_event_id uuid;
  v_existing record;
  v_response jsonb;
  v_request_payload jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;
  PERFORM public.require_active_user();

  IF p_items IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'POS transaction must contain at least one item';
  END IF;

  IF upper(trim(coalesce(p_payment_method, ''))) NOT IN ('CASH', 'CHEQUE') THEN
    RAISE EXCEPTION 'Only CASH and CHEQUE payment methods are currently supported';
  END IF;
  IF p_amount_received IS NULL OR p_amount_received < 0 THEN
    RAISE EXCEPTION 'Amount received cannot be null or negative';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Checkout request ID is required';
  END IF;

  FOR item IN
    SELECT raw_item.product_id, raw_item.quantity
    FROM jsonb_to_recordset(p_items) AS raw_item(product_id text, quantity bigint)
  LOOP
    IF item.product_id IS NULL OR btrim(item.product_id) = '' THEN
      RAISE EXCEPTION 'Every POS item must contain a product_id';
    END IF;
    IF item.quantity IS NULL OR item.quantity <= 0 THEN
      RAISE EXCEPTION 'Every POS item quantity must be greater than zero';
    END IF;
  END LOOP;

  area_code_value := upper(btrim(p_area_code));
  IF area_code_value IS NULL OR area_code_value NOT IN ('IAO', 'CBR', 'EFT') THEN
    RAISE EXCEPTION 'A valid POS area (IAO, CBR, or EFT) is required';
  END IF;

  v_request_payload := jsonb_build_object(
    'customer_name', coalesce(p_customer_name, ''),
    'customer_address', coalesce(p_customer_address, ''),
    'customer_phone', coalesce(p_customer_phone, ''),
    'amount_received', p_amount_received,
    'payment_method', upper(trim(p_payment_method)),
    'area_code', area_code_value,
    'items', (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object('product_id', grouped.product_id, 'quantity', grouped.quantity)
          ORDER BY grouped.product_id
        ),
        '[]'::jsonb
      )
      FROM (
        SELECT raw_item.product_id, sum(raw_item.quantity)::bigint AS quantity
        FROM jsonb_to_recordset(p_items) AS raw_item(product_id text, quantity bigint)
        GROUP BY raw_item.product_id
      ) AS grouped
    )
  );

  PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  SELECT transaction_id, action, request_payload, response, actor_user_id
  INTO v_existing
  FROM public.pos_transaction_requests
  WHERE request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.action <> 'CHECKOUT'
       OR v_existing.actor_user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Request ID has already been used for a different operation';
    END IF;
    IF v_existing.request_payload IS DISTINCT FROM v_request_payload THEN
      RAISE EXCEPTION 'Checkout request ID has already been used with a different payload';
    END IF;
    IF v_existing.response IS NULL THEN
      RAISE EXCEPTION 'Checkout request has no committed response; contact support before retrying';
    END IF;
    RETURN v_existing.response;
  END IF;

  FOR product_id_value IN
    SELECT DISTINCT raw_item.product_id
    FROM jsonb_to_recordset(p_items) AS raw_item(product_id text, quantity bigint)
    ORDER BY raw_item.product_id
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(product_id_value, 0));
  END LOOP;

  FOR item IN
    SELECT raw_item.product_id, sum(raw_item.quantity)::bigint AS quantity
    FROM jsonb_to_recordset(p_items) AS raw_item(product_id text, quantity bigint)
    GROUP BY raw_item.product_id
    ORDER BY raw_item.product_id
  LOOP
    BEGIN
      SELECT p.id, p.name, p.code, p.unit, p.price
      INTO STRICT product_row
      FROM public.products AS p
      WHERE p.id = item.product_id
      FOR UPDATE;
    EXCEPTION WHEN no_data_found THEN
      RAISE EXCEPTION 'Product not found: %', item.product_id;
    END;

    SELECT coalesce(sum(
      CASE WHEN t.type = 'IN' THEN t.quantity
           WHEN t.type = 'OUT' THEN -t.quantity
           ELSE t.quantity END
    ), 0)::bigint
    INTO current_stock
    FROM public.transactions AS t
    WHERE t.product_id = item.product_id;

    IF current_stock < item.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product %. Available: %, requested: %',
        item.product_id, current_stock, item.quantity;
    END IF;
    subtotal_amount := subtotal_amount + product_row.price * item.quantity;
    total_quantity := total_quantity + item.quantity;
  END LOOP;

  subtotal_amount := round(subtotal_amount, 2);
  IF upper(trim(coalesce(p_payment_method, ''))) = 'CHEQUE' THEN
    IF p_amount_received <> subtotal_amount THEN
      RAISE EXCEPTION 'For CHEQUE payment, amount received must equal the exact transaction total';
    END IF;
    change_amount := 0;
  ELSE
    IF p_amount_received < subtotal_amount THEN
      RAISE EXCEPTION 'Amount received is less than the transaction total';
    END IF;
    change_amount := round(p_amount_received - subtotal_amount, 2);
  END IF;

  v_receipt_year := extract(year FROM transaction_timestamp())::integer;
  INSERT INTO public.pos_area_receipt_counters (area_code, receipt_year, last_number)
  VALUES (area_code_value, v_receipt_year, 0)
  ON CONFLICT (area_code, receipt_year) DO NOTHING;

  UPDATE public.pos_area_receipt_counters AS c
  SET last_number = c.last_number + 1
  WHERE c.area_code = area_code_value AND c.receipt_year = v_receipt_year
  RETURNING c.last_number INTO receipt_number;
  IF receipt_number IS NULL THEN
    RAISE EXCEPTION 'Receipt counter could not be initialized for area % and year %',
      area_code_value, v_receipt_year;
  END IF;

  display_receipt_number := area_code_value || '-' || lpad(receipt_number::text, 4, '0');
  transaction_id := gen_random_uuid();
  INSERT INTO public.pos_transactions (
    id, delivery_receipt_sequence, area_code, receipt_year, receipt_number,
    customer_name, customer_address, customer_phone, subtotal, total_amount,
    amount_received, change_amount, payment_method, transaction_status,
    created_at, created_by, revision_number
  ) VALUES (
    transaction_id::text, NULL, area_code_value, v_receipt_year, receipt_number,
    coalesce(p_customer_name, ''), coalesce(p_customer_address, ''),
    coalesce(p_customer_phone, ''), subtotal_amount, subtotal_amount,
    p_amount_received, change_amount, upper(trim(p_payment_method)),
    'COMPLETED', now(), auth.uid(), 1
  );

  INSERT INTO public.pos_transaction_requests (
    request_id, transaction_id, action, request_payload, actor_user_id
  ) VALUES (
    p_request_id, transaction_id::text, 'CHECKOUT', v_request_payload, auth.uid()
  );

  INSERT INTO public.pos_transaction_events (
    transaction_id, event_type, revision_number, from_status, to_status,
    actor_user_id, request_id, details
  ) VALUES (
    transaction_id::text, 'CREATED', 1, NULL, 'COMPLETED', auth.uid(), p_request_id,
    jsonb_build_object('display_receipt_number', display_receipt_number)
  ) RETURNING id INTO v_event_id;

  FOR item IN
    SELECT raw_item.product_id, sum(raw_item.quantity)::bigint AS quantity
    FROM jsonb_to_recordset(p_items) AS raw_item(product_id text, quantity bigint)
    GROUP BY raw_item.product_id
    ORDER BY raw_item.product_id
  LOOP
    SELECT p.id, p.name, p.code, p.unit, p.price
    INTO STRICT product_row
    FROM public.products AS p
    WHERE p.id = item.product_id
    FOR UPDATE;

    INSERT INTO public.pos_transaction_items (
      transaction_id, product_id, product_name_snapshot,
      product_code_snapshot, unit_snapshot, quantity, unit_price, line_amount
    ) VALUES (
      transaction_id::text, product_row.id, product_row.name, product_row.code,
      product_row.unit, item.quantity, product_row.price,
      round(product_row.price * item.quantity, 2)
    );

    INSERT INTO public.transactions (
      id, product_id, type, quantity, date, remarks,
      pos_transaction_id, pos_revision, pos_event_id
    ) VALUES (
      gen_random_uuid()::text, product_row.id, 'OUT', item.quantity, now(),
      'POS sale ' || display_receipt_number,
      transaction_id::text, 1, v_event_id
    );
  END LOOP;

  INSERT INTO public.pos_transaction_revisions (
    transaction_id, revision_number, snapshot, actor_user_id, reason
  ) VALUES (
    transaction_id::text, 1, public.pos_transaction_snapshot(transaction_id::text),
    auth.uid(), 'Original POS sale'
  );

  v_response := jsonb_build_object(
    'transaction_id', transaction_id,
    'delivery_receipt_sequence', NULL,
    'delivery_receipt_number', NULL,
    'area_code', area_code_value,
    'receipt_year', v_receipt_year,
    'receipt_number', receipt_number,
    'display_receipt_number', display_receipt_number,
    'subtotal', subtotal_amount,
    'total_amount', subtotal_amount,
    'amount_received', p_amount_received,
    'change_amount', change_amount,
    'total_quantity', total_quantity,
    'payment_method', upper(trim(p_payment_method)),
    'transaction_status', 'COMPLETED'
  );
  UPDATE public.pos_transaction_requests
  SET response = v_response
  WHERE request_id = p_request_id;
  RETURN v_response;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_pos_transaction_for_area(text, text, text, numeric, text, jsonb, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_pos_transaction_for_area(text, text, text, numeric, text, jsonb, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_pos_transaction(
  p_customer_name text DEFAULT ''::text,
  p_customer_address text DEFAULT ''::text,
  p_customer_phone text DEFAULT ''::text,
  p_amount_received numeric DEFAULT 0,
  p_payment_method text DEFAULT 'CASH'::text,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_area_code text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;
  PERFORM public.require_active_user();
  SELECT uaa.area_code INTO STRICT v_area_code
  FROM public.user_area_assignments AS uaa
  WHERE uaa.user_id = auth.uid();
  RETURN public.create_pos_transaction_for_area(
    p_customer_name, p_customer_address, p_customer_phone,
    p_amount_received, p_payment_method, p_items, v_area_code, gen_random_uuid()
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_pos_transaction(text, text, text, numeric, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_pos_transaction(text, text, text, numeric, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_pos_transaction_with_request(
  p_transaction_id text,
  p_cancellation_reason text DEFAULT NULL,
  p_request_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_pos record;
  v_item record;
  v_event_id uuid;
  v_display_receipt_number text;
  v_cancelled_at timestamptz := now();
  v_restored_item_count integer := 0;
  v_restored_quantity bigint := 0;
  v_existing record;
  v_response jsonb;
  v_request_payload jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;
  PERFORM public.require_active_user();
  IF p_transaction_id IS NULL OR btrim(p_transaction_id) = '' THEN
    RAISE EXCEPTION 'POS transaction ID is required';
  END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'Request ID is required'; END IF;
  v_request_payload := jsonb_build_object(
    'reason', nullif(btrim(p_cancellation_reason), '')
  );

  PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  SELECT transaction_id, action, request_payload, response, actor_user_id
  INTO v_existing
  FROM public.pos_transaction_requests WHERE request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.transaction_id <> p_transaction_id
       OR v_existing.action <> 'CANCEL'
       OR v_existing.actor_user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Request ID has already been used for a different operation';
    END IF;
    IF v_existing.request_payload IS DISTINCT FROM v_request_payload THEN
      RAISE EXCEPTION 'Request ID has already been used with a different cancellation reason';
    END IF;
    RETURN v_existing.response;
  END IF;

  SELECT pt.id, pt.area_code, pt.receipt_number, pt.delivery_receipt_sequence,
         pt.transaction_status, pt.revision_number
  INTO v_pos
  FROM public.pos_transactions AS pt
  WHERE pt.id = p_transaction_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'POS transaction not found'; END IF;
  IF v_pos.transaction_status <> 'COMPLETED' THEN
    RAISE EXCEPTION 'Only completed POS transactions can be cancelled';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.iao_outlet_orders AS io
    WHERE io.source_pos_transaction_id = p_transaction_id
  ) THEN
    RAISE EXCEPTION 'This POS transaction cannot be cancelled because it has already been copied to an IAO outlet order';
  END IF;

  FOR v_item IN
    SELECT DISTINCT pti.product_id
    FROM public.pos_transaction_items AS pti
    WHERE pti.transaction_id = p_transaction_id
    ORDER BY pti.product_id
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(v_item.product_id, 0));
    PERFORM 1 FROM public.products AS p
    WHERE p.id = v_item.product_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product not found: %', v_item.product_id; END IF;
  END LOOP;
  SELECT count(*), coalesce(sum(pti.quantity), 0)
  INTO v_restored_item_count, v_restored_quantity
  FROM public.pos_transaction_items AS pti
  WHERE pti.transaction_id = p_transaction_id;
  IF v_restored_item_count = 0 THEN RAISE EXCEPTION 'POS transaction has no items to restore'; END IF;

  v_display_receipt_number := CASE
    WHEN v_pos.area_code IS NOT NULL AND v_pos.receipt_number IS NOT NULL
      THEN v_pos.area_code || '-' || lpad(v_pos.receipt_number::text, 4, '0')
    WHEN v_pos.delivery_receipt_sequence IS NOT NULL
      THEN 'DR-' || lpad(v_pos.delivery_receipt_sequence::text, 4, '0')
    ELSE '-' END;

  INSERT INTO public.pos_transaction_requests (
    request_id, transaction_id, action, request_payload, actor_user_id
  ) VALUES (
    p_request_id, p_transaction_id, 'CANCEL', v_request_payload, auth.uid()
  );
  INSERT INTO public.pos_transaction_events (
    transaction_id, event_type, revision_number, from_status, to_status,
    actor_user_id, request_id, reason, details, created_at
  ) VALUES (
    p_transaction_id, 'CANCELLED', v_pos.revision_number, 'COMPLETED',
    'CANCELLED', auth.uid(), p_request_id,
    nullif(btrim(p_cancellation_reason), ''),
    jsonb_build_object('display_receipt_number', v_display_receipt_number),
    v_cancelled_at
  ) RETURNING id INTO v_event_id;

  FOR v_item IN
    SELECT pti.product_id, pti.quantity
    FROM public.pos_transaction_items AS pti
    WHERE pti.transaction_id = p_transaction_id
    ORDER BY pti.product_id
  LOOP
    INSERT INTO public.transactions (
      id, product_id, type, quantity, date, remarks,
      pos_transaction_id, pos_revision, pos_event_id
    ) VALUES (
      gen_random_uuid()::text, v_item.product_id, 'ADJUSTMENT', v_item.quantity,
      v_cancelled_at, 'POS cancellation ' || v_display_receipt_number,
      p_transaction_id, v_pos.revision_number, v_event_id
    );
  END LOOP;

  UPDATE public.pos_transactions
  SET transaction_status = 'CANCELLED', cancelled_at = v_cancelled_at,
      cancelled_by = auth.uid(),
      cancellation_reason = nullif(btrim(p_cancellation_reason), '')
  WHERE id = p_transaction_id;

  v_response := jsonb_build_object(
    'transaction_id', p_transaction_id,
    'display_receipt_number', v_display_receipt_number,
    'transaction_status', 'CANCELLED',
    'cancelled_at', v_cancelled_at,
    'restored_item_count', v_restored_item_count,
    'restored_quantity', v_restored_quantity,
    'revision_number', v_pos.revision_number
  );
  UPDATE public.pos_transaction_requests SET response = v_response WHERE request_id = p_request_id;
  RETURN v_response;
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_pos_transaction_with_request(text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_pos_transaction_with_request(text, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_pos_transaction(
  p_transaction_id text,
  p_cancellation_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN public.cancel_pos_transaction_with_request(
    p_transaction_id, p_cancellation_reason, gen_random_uuid()
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_pos_transaction(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_pos_transaction(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.modify_pos_transaction(
  p_transaction_id text,
  p_expected_revision integer,
  p_request_id uuid,
  p_customer_name text,
  p_customer_address text,
  p_customer_phone text,
  p_items jsonb,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_pos record;
  v_product_id text;
  v_product record;
  v_item record;
  v_current_stock bigint;
  v_old_quantity bigint;
  v_new_quantity bigint;
  v_delta bigint;
  v_subtotal numeric(12,2) := 0;
  v_total_quantity bigint := 0;
  v_new_revision integer;
  v_event_id uuid;
  v_reopened_event_id uuid;
  v_existing record;
  v_response jsonb;
  v_request_payload jsonb;
  v_receipt text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;
  PERFORM public.require_active_user();
  IF p_transaction_id IS NULL OR btrim(p_transaction_id) = '' THEN
    RAISE EXCEPTION 'POS transaction ID is required';
  END IF;
  IF p_expected_revision IS NULL OR p_expected_revision < 1 THEN
    RAISE EXCEPTION 'Expected revision is required';
  END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'Request ID is required'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Corrected POS transaction must contain at least one item';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_items) AS raw_item(product_id text, quantity bigint)
    WHERE product_id IS NULL OR btrim(product_id) = ''
       OR quantity IS NULL OR quantity <= 0
  ) THEN
    RAISE EXCEPTION 'Every corrected item requires a product and quantity greater than zero';
  END IF;
  v_request_payload := jsonb_build_object(
    'expected_revision', p_expected_revision,
    'customer_name', coalesce(p_customer_name, ''),
    'customer_address', coalesce(p_customer_address, ''),
    'customer_phone', coalesce(p_customer_phone, ''),
    'reason', nullif(btrim(p_reason), ''),
    'items', (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object('product_id', grouped.product_id, 'quantity', grouped.quantity)
          ORDER BY grouped.product_id
        ),
        '[]'::jsonb
      )
      FROM (
        SELECT raw_item.product_id, sum(raw_item.quantity)::bigint AS quantity
        FROM jsonb_to_recordset(p_items) AS raw_item(product_id text, quantity bigint)
        GROUP BY raw_item.product_id
      ) AS grouped
    )
  );

  PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  SELECT transaction_id, action, request_payload, response, actor_user_id
  INTO v_existing
  FROM public.pos_transaction_requests WHERE request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.transaction_id <> p_transaction_id
       OR v_existing.action <> 'MODIFY'
       OR v_existing.actor_user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Request ID has already been used for a different operation';
    END IF;
    IF v_existing.request_payload IS DISTINCT FROM v_request_payload THEN
      RAISE EXCEPTION 'Request ID has already been used with a different modification payload';
    END IF;
    RETURN v_existing.response;
  END IF;

  SELECT pt.id, pt.area_code, pt.receipt_year, pt.receipt_number,
         pt.delivery_receipt_sequence, pt.transaction_status,
         pt.revision_number
  INTO v_pos
  FROM public.pos_transactions AS pt
  WHERE pt.id = p_transaction_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'POS transaction not found'; END IF;
  IF v_pos.transaction_status NOT IN ('COMPLETED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Only completed or cancelled POS transactions can be modified';
  END IF;
  IF v_pos.revision_number <> p_expected_revision THEN
    RAISE EXCEPTION 'POS transaction changed since it was opened; reload before saving';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.iao_outlet_orders AS io
    WHERE io.source_pos_transaction_id = p_transaction_id
  ) THEN
    RAISE EXCEPTION 'This POS transaction cannot be modified because it has already been copied to an IAO outlet order';
  END IF;

  FOR v_product_id IN
    SELECT product_id FROM (
      SELECT pti.product_id FROM public.pos_transaction_items AS pti
      WHERE pti.transaction_id = p_transaction_id
      UNION
      SELECT raw_item.product_id
      FROM jsonb_to_recordset(p_items) AS raw_item(product_id text, quantity bigint)
    ) AS ids
    ORDER BY product_id
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(v_product_id, 0));
    PERFORM 1 FROM public.products AS p WHERE p.id = v_product_id FOR UPDATE;
    IF NOT FOUND AND EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_items) AS raw_item(product_id text, quantity bigint)
      WHERE raw_item.product_id = v_product_id
    ) THEN
      RAISE EXCEPTION 'Product not found: %', v_product_id;
    END IF;
  END LOOP;

  FOR v_item IN
    SELECT raw_item.product_id, sum(raw_item.quantity)::bigint AS quantity
    FROM jsonb_to_recordset(p_items) AS raw_item(product_id text, quantity bigint)
    GROUP BY raw_item.product_id
    ORDER BY raw_item.product_id
  LOOP
    SELECT p.id, p.name, p.code, p.unit, p.price
    INTO STRICT v_product
    FROM public.products AS p
    WHERE p.id = v_item.product_id;
    v_subtotal := v_subtotal + round(v_product.price, 2) * v_item.quantity;
    v_total_quantity := v_total_quantity + v_item.quantity;
  END LOOP;
  v_subtotal := round(v_subtotal, 2);

  FOR v_product_id IN
    SELECT product_id FROM (
      SELECT pti.product_id FROM public.pos_transaction_items AS pti
      WHERE pti.transaction_id = p_transaction_id
      UNION
      SELECT raw_item.product_id
      FROM jsonb_to_recordset(p_items) AS raw_item(product_id text, quantity bigint)
    ) AS ids
    ORDER BY product_id
  LOOP
    SELECT coalesce(sum(
      CASE WHEN t.type = 'IN' THEN t.quantity
           WHEN t.type = 'OUT' THEN -t.quantity
           ELSE t.quantity END
    ), 0)::bigint
    INTO v_current_stock
    FROM public.transactions AS t WHERE t.product_id = v_product_id;

    SELECT coalesce(sum(pti.quantity), 0)::bigint INTO v_old_quantity
    FROM public.pos_transaction_items AS pti
    WHERE pti.transaction_id = p_transaction_id AND pti.product_id = v_product_id;
    IF v_pos.transaction_status = 'CANCELLED' THEN v_old_quantity := 0; END IF;

    SELECT coalesce(sum(raw_item.quantity), 0)::bigint INTO v_new_quantity
    FROM jsonb_to_recordset(p_items) AS raw_item(product_id text, quantity bigint)
    WHERE raw_item.product_id = v_product_id;
    v_delta := v_old_quantity - v_new_quantity;
    IF v_delta < 0 AND v_current_stock < abs(v_delta) THEN
      RAISE EXCEPTION 'Insufficient stock for product %. Available: %, additional quantity required: %',
        v_product_id, v_current_stock, abs(v_delta);
    END IF;
  END LOOP;

  v_new_revision := v_pos.revision_number + 1;
  v_receipt := CASE
    WHEN v_pos.area_code IS NOT NULL AND v_pos.receipt_number IS NOT NULL
      THEN v_pos.area_code || '-' || lpad(v_pos.receipt_number::text, 4, '0')
    WHEN v_pos.delivery_receipt_sequence IS NOT NULL
      THEN 'DR-' || lpad(v_pos.delivery_receipt_sequence::text, 4, '0')
    ELSE '-' END;

  INSERT INTO public.pos_transaction_requests (
    request_id, transaction_id, action, request_payload, actor_user_id
  ) VALUES (
    p_request_id, p_transaction_id, 'MODIFY', v_request_payload, auth.uid()
  );

  IF v_pos.transaction_status = 'CANCELLED' THEN
    INSERT INTO public.pos_transaction_events (
      transaction_id, event_type, revision_number, from_status, to_status,
      actor_user_id, request_id, reason, details, created_at
    ) VALUES (
      p_transaction_id, 'REOPENED', v_new_revision, 'CANCELLED', 'COMPLETED',
      auth.uid(), p_request_id, nullif(btrim(p_reason), ''),
      jsonb_build_object('display_receipt_number', v_receipt), clock_timestamp()
    ) RETURNING id INTO v_reopened_event_id;
  END IF;

  INSERT INTO public.pos_transaction_events (
    transaction_id, event_type, revision_number, from_status, to_status,
    actor_user_id, request_id, reason, details, created_at
  ) VALUES (
    p_transaction_id, 'MODIFIED', v_new_revision,
    v_pos.transaction_status, 'COMPLETED', auth.uid(), p_request_id,
    nullif(btrim(p_reason), ''),
    jsonb_build_object(
      'display_receipt_number', v_receipt,
      'reopened_event_id', v_reopened_event_id
    ), clock_timestamp()
  ) RETURNING id INTO v_event_id;

  UPDATE public.pos_transactions
  SET customer_name = coalesce(p_customer_name, ''),
      customer_address = coalesce(p_customer_address, ''),
      customer_phone = coalesce(p_customer_phone, ''),
      subtotal = v_subtotal,
      total_amount = v_subtotal,
      transaction_status = 'COMPLETED',
      revision_number = v_new_revision,
      cancelled_at = NULL,
      cancelled_by = NULL,
      cancellation_reason = NULL
  WHERE id = p_transaction_id;

  DELETE FROM public.pos_transaction_items WHERE transaction_id = p_transaction_id;
  FOR v_item IN
    SELECT raw_item.product_id, sum(raw_item.quantity)::bigint AS quantity
    FROM jsonb_to_recordset(p_items) AS raw_item(product_id text, quantity bigint)
    GROUP BY raw_item.product_id
    ORDER BY raw_item.product_id
  LOOP
    SELECT p.id, p.name, p.code, p.unit, p.price
    INTO STRICT v_product
    FROM public.products AS p
    WHERE p.id = v_item.product_id;
    INSERT INTO public.pos_transaction_items (
      transaction_id, product_id, product_name_snapshot,
      product_code_snapshot, unit_snapshot, quantity, unit_price, line_amount
    ) VALUES (
      p_transaction_id, v_product.id, v_product.name, v_product.code,
      v_product.unit, v_item.quantity, round(v_product.price, 2),
      round(round(v_product.price, 2) * v_item.quantity, 2)
    );
  END LOOP;

  FOR v_product_id IN
    SELECT product_id FROM (
      SELECT pti.product_id FROM public.pos_transaction_items AS pti
      WHERE pti.transaction_id = p_transaction_id
      UNION
      SELECT old_item.product_id
      FROM public.pos_transaction_revisions AS r
      CROSS JOIN LATERAL jsonb_to_recordset(r.snapshot -> 'items')
        AS old_item(product_id text, quantity bigint)
      WHERE r.transaction_id = p_transaction_id
        AND r.revision_number = v_pos.revision_number
    ) AS ids
    ORDER BY product_id
  LOOP
    SELECT coalesce(sum(raw_item.quantity), 0)::bigint INTO v_new_quantity
    FROM jsonb_to_recordset(p_items) AS raw_item(product_id text, quantity bigint)
    WHERE raw_item.product_id = v_product_id;
    SELECT coalesce(sum(old_item.quantity), 0)::bigint INTO v_old_quantity
    FROM public.pos_transaction_revisions AS r
    CROSS JOIN LATERAL jsonb_to_recordset(r.snapshot -> 'items')
      AS old_item(product_id text, quantity bigint)
    WHERE r.transaction_id = p_transaction_id
      AND r.revision_number = v_pos.revision_number
      AND v_pos.transaction_status = 'COMPLETED'
      AND old_item.product_id = v_product_id;
    IF v_pos.transaction_status = 'CANCELLED' THEN v_old_quantity := 0; END IF;
    v_delta := v_old_quantity - v_new_quantity;
    IF v_delta <> 0 THEN
      INSERT INTO public.transactions (
        id, product_id, type, quantity, date, remarks,
        pos_transaction_id, pos_revision, pos_event_id
      ) VALUES (
        gen_random_uuid()::text, v_product_id, 'ADJUSTMENT', v_delta, now(),
        'POS modification ' || v_receipt,
        p_transaction_id, v_new_revision, v_event_id
      );
    END IF;
  END LOOP;

  INSERT INTO public.pos_transaction_revisions (
    transaction_id, revision_number, snapshot, actor_user_id, reason
  ) VALUES (
    p_transaction_id, v_new_revision,
    public.pos_transaction_snapshot(p_transaction_id),
    auth.uid(), nullif(btrim(p_reason), '')
  );

  v_response := jsonb_build_object(
    'transaction_id', p_transaction_id,
    'display_receipt_number', v_receipt,
    'transaction_status', 'COMPLETED',
    'revision_number', v_new_revision,
    'subtotal', v_subtotal,
    'total_quantity', v_total_quantity,
    'reopened', v_pos.transaction_status = 'CANCELLED'
  );
  UPDATE public.pos_transaction_requests SET response = v_response WHERE request_id = p_request_id;
  RETURN v_response;
END;
$function$;

REVOKE ALL ON FUNCTION public.modify_pos_transaction(text, integer, uuid, text, text, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.modify_pos_transaction(text, integer, uuid, text, text, text, jsonb, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_pos_transaction_audit(p_transaction_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;
  PERFORM public.require_active_user();
  IF NOT EXISTS (SELECT 1 FROM public.pos_transactions WHERE id = p_transaction_id) THEN
    RAISE EXCEPTION 'POS transaction not found';
  END IF;

  SELECT jsonb_build_object(
    'transaction_id', pt.id,
    'revision_number', pt.revision_number,
    'current_transaction_status', pt.transaction_status,
    'copied_to_iao', EXISTS (
      SELECT 1 FROM public.iao_outlet_orders AS io
      WHERE io.source_pos_transaction_id = pt.id
    ),
    'revisions', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'revision_number', r.revision_number,
        'snapshot', r.snapshot,
        'actor_user_id', r.actor_user_id,
        'reason', r.reason,
        'created_at', r.created_at
      ) ORDER BY r.revision_number DESC)
      FROM public.pos_transaction_revisions AS r
      WHERE r.transaction_id = pt.id
    ), '[]'::jsonb),
    'events', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'event_type', e.event_type,
        'revision_number', e.revision_number,
        'from_status', e.from_status,
        'to_status', e.to_status,
        'actor_user_id', e.actor_user_id,
        'reason', e.reason,
        'created_at', e.created_at,
        'details', e.details
      ) ORDER BY e.created_at, e.id)
      FROM public.pos_transaction_events AS e
      WHERE e.transaction_id = pt.id
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM public.pos_transactions AS pt
  WHERE pt.id = p_transaction_id;
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_pos_transaction_audit(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pos_transaction_audit(text) TO authenticated;
