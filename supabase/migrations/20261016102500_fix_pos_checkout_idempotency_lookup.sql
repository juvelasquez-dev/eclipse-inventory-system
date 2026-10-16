BEGIN;

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
  SELECT r.transaction_id, r.action, r.request_payload, r.response, r.actor_user_id
  INTO v_existing
  FROM public.pos_transaction_requests AS r
  WHERE r.request_id = p_request_id;
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

COMMIT;
