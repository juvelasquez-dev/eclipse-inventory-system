-- IAO "Copy from Eclipse POS" feature.
-- Additive only: existing manual IAO ordering, POS, and Inventory behavior
-- are untouched. No writes to products, transactions, pos_transactions,
-- pos_transaction_items, or pos_area_receipt_counters happen anywhere below.

-- New nullable source-tracking columns. Existing manual IAO orders keep
-- NULL here and are unaffected. The existing (receipt_year, receipt_number)
-- unique constraint and NOT NULL columns are left exactly as they are.
-- pos_transactions.id is TEXT on the live database, not uuid.
ALTER TABLE public.iao_outlet_orders
  ADD COLUMN source_pos_transaction_id text NULL
    REFERENCES public.pos_transactions(id) ON DELETE RESTRICT,
  ADD COLUMN source_area_code text NULL,
  ADD COLUMN source_receipt_year integer NULL,
  ADD COLUMN source_receipt_number bigint NULL;

-- One POS transaction can only ever back one IAO order. Postgres unique
-- constraints treat NULLs as distinct, so manually-created orders
-- (source_pos_transaction_id IS NULL) are never affected by this.
ALTER TABLE public.iao_outlet_orders
  ADD CONSTRAINT iao_outlet_orders_source_pos_transaction_unique
    UNIQUE (source_pos_transaction_id);

-- The four source_* columns are either all present (copied order) or all
-- absent (manual order); never a partial mix.
ALTER TABLE public.iao_outlet_orders
  ADD CONSTRAINT iao_outlet_orders_source_columns_consistency_check
    CHECK (
      (
        source_pos_transaction_id IS NULL
        AND source_area_code IS NULL
        AND source_receipt_year IS NULL
        AND source_receipt_number IS NULL
      ) OR (
        source_pos_transaction_id IS NOT NULL
        AND source_area_code IS NOT NULL
        AND source_receipt_year IS NOT NULL
        AND source_receipt_number IS NOT NULL
      )
    );


-- Read-only: eligible completed POS transactions for active IAO outlets,
-- regardless of the punching cashier's area. Only callers assigned to the
-- IAO area may execute this. No broad table SELECT grants are added;
-- pos_transactions/pos_transaction_items privileges are unchanged.
CREATE OR REPLACE FUNCTION public.list_iao_eligible_pos_transactions()
RETURNS TABLE (
  pos_transaction_id text,
  source_area_code text,
  source_receipt_year integer,
  source_receipt_number bigint,
  source_receipt text,
  created_at timestamptz,
  outlet_id uuid,
  outlet_name text,
  outlet_address text,
  total_amount numeric,
  payment_method text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_area_code text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  SELECT area_code INTO v_area_code
  FROM public.user_area_assignments
  WHERE user_id = auth.uid();

  IF v_area_code IS DISTINCT FROM 'IAO' THEN
    RAISE EXCEPTION 'Access denied: IAO area assignment required';
  END IF;

  RETURN QUERY
  SELECT
    pt.id,
    pt.area_code,
    pt.receipt_year,
    pt.receipt_number,
    pt.area_code || '-' || lpad(pt.receipt_number::text, 4, '0'),
    pt.created_at,
    o.id,
    o.outlet_name,
    o.complete_address,
    pt.total_amount,
    pt.payment_method
  FROM public.pos_transactions pt
  JOIN public.outlets o
    ON o.area_code = 'IAO'
    AND o.status = 'Active'
    AND lower(btrim(o.outlet_name)) = lower(btrim(pt.customer_name))
    AND lower(btrim(o.complete_address)) = lower(btrim(pt.customer_address))
  WHERE pt.transaction_status = 'COMPLETED'
    AND NOT EXISTS (
      SELECT 1
      FROM public.iao_outlet_orders io
      WHERE io.source_pos_transaction_id = pt.id
    )
  ORDER BY pt.created_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_iao_eligible_pos_transactions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_iao_eligible_pos_transactions() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_iao_eligible_pos_transactions() TO authenticated;


-- Read-only: line items for one eligible source POS transaction, used by
-- the frontend to build the copy-preview table before the user confirms.
-- Re-validates the same eligibility rules as the copy RPC below.
CREATE OR REPLACE FUNCTION public.get_iao_pos_transaction_preview(
  p_pos_transaction_id text
)
RETURNS TABLE (
  product_id text,
  product_name_snapshot text,
  product_code_snapshot text,
  unit_snapshot text,
  eclipse_reference_unit_price numeric,
  quantity bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_area_code text;
  v_pos record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  SELECT area_code INTO v_area_code
  FROM public.user_area_assignments
  WHERE user_id = auth.uid();

  IF v_area_code IS DISTINCT FROM 'IAO' THEN
    RAISE EXCEPTION 'Access denied: IAO area assignment required';
  END IF;

  SELECT customer_name, customer_address, transaction_status
  INTO v_pos
  FROM public.pos_transactions
  WHERE id = p_pos_transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source POS transaction not found';
  END IF;

  IF v_pos.transaction_status <> 'COMPLETED' THEN
    RAISE EXCEPTION 'Only completed POS transactions can be previewed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.outlets o
    WHERE o.area_code = 'IAO'
      AND o.status = 'Active'
      AND lower(btrim(o.outlet_name)) = lower(btrim(v_pos.customer_name))
      AND lower(btrim(o.complete_address)) = lower(btrim(v_pos.customer_address))
  ) THEN
    RAISE EXCEPTION 'Source POS transaction does not match an active IAO outlet';
  END IF;

  RETURN QUERY
  SELECT
    pti.product_id,
    pti.product_name_snapshot,
    pti.product_code_snapshot,
    pti.unit_snapshot,
    pti.unit_price,
    pti.quantity
  FROM public.pos_transaction_items pti
  WHERE pti.transaction_id = p_pos_transaction_id
  ORDER BY pti.product_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_iao_pos_transaction_preview(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_iao_pos_transaction_preview(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_iao_pos_transaction_preview(text) TO authenticated;


-- Creates one IAO outlet order copied from a completed Eclipse POS
-- transaction. Never writes to products, transactions, pos_transactions,
-- pos_transaction_items, or pos_area_receipt_counters. The internal
-- iao_outlet_order_receipt_counters sequence is still advanced (same as
-- the manual flow) purely so receipt_year/receipt_number stay populated
-- and unique per the existing schema; the DISPLAYED receipt identity for
-- a copied order is the source POS receipt, not this internal number.
CREATE OR REPLACE FUNCTION public.create_iao_outlet_order_from_pos(
  p_pos_transaction_id text,
  p_selling_prices jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_area_code text;
  v_pos record;
  v_outlet record;
  v_item record;
  v_selling_price numeric(14, 2);
  v_order_id uuid;
  v_receipt_year integer;
  v_receipt_number bigint;
  v_grand_total numeric(14, 2) := 0;
  v_line_total numeric(14, 2);
  v_created_at timestamptz := transaction_timestamp();
  v_receipt_items jsonb := '[]'::jsonb;
  v_source_receipt text;
  v_item_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  SELECT area_code INTO v_area_code
  FROM public.user_area_assignments
  WHERE user_id = auth.uid();

  IF v_area_code IS DISTINCT FROM 'IAO' THEN
    RAISE EXCEPTION 'Access denied: IAO area assignment required';
  END IF;

  IF p_pos_transaction_id IS NULL THEN
    RAISE EXCEPTION 'A source POS transaction is required';
  END IF;

  IF jsonb_typeof(p_selling_prices) IS DISTINCT FROM 'object'
     OR p_selling_prices = '{}'::jsonb THEN
    RAISE EXCEPTION 'IAO selling prices are required for every copied item';
  END IF;

  -- Read-only lock on the source row; never updated here.
  SELECT id, area_code, receipt_year, receipt_number, customer_name,
         customer_address, transaction_status
  INTO v_pos
  FROM public.pos_transactions
  WHERE id = p_pos_transaction_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source POS transaction not found';
  END IF;

  IF v_pos.transaction_status <> 'COMPLETED' THEN
    RAISE EXCEPTION 'Only completed POS transactions can be copied';
  END IF;

  SELECT id, outlet_name, complete_address, contact_number
  INTO v_outlet
  FROM public.outlets
  WHERE area_code = 'IAO'
    AND status = 'Active'
    AND lower(btrim(outlet_name)) = lower(btrim(v_pos.customer_name))
    AND lower(btrim(complete_address)) = lower(btrim(v_pos.customer_address))
  FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source POS transaction does not match an active IAO outlet';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.iao_outlet_orders
    WHERE source_pos_transaction_id = p_pos_transaction_id
  ) THEN
    RAISE EXCEPTION 'This POS transaction has already been copied.';
  END IF;

  v_source_receipt := v_pos.area_code || '-' || lpad(v_pos.receipt_number::text, 4, '0');

  FOR v_item IN
    SELECT product_id, product_name_snapshot, product_code_snapshot,
           unit_snapshot, unit_price, quantity
    FROM public.pos_transaction_items
    WHERE transaction_id = p_pos_transaction_id
    ORDER BY product_id
  LOOP
    v_item_count := v_item_count + 1;

    IF NOT (p_selling_prices ? v_item.product_id) THEN
      RAISE EXCEPTION 'Missing IAO selling price for product: %', v_item.product_id;
    END IF;

    v_selling_price := round((p_selling_prices ->> v_item.product_id)::numeric, 2);

    IF v_selling_price IS NULL OR v_selling_price <= 0 THEN
      RAISE EXCEPTION 'IAO selling price must be greater than zero for product: %', v_item.product_id;
    END IF;

    v_line_total := round(v_selling_price * v_item.quantity, 2);
    v_grand_total := v_grand_total + v_line_total;
  END LOOP;

  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'Source POS transaction has no items to copy';
  END IF;

  v_grand_total := round(v_grand_total, 2);
  IF v_grand_total <= 0 THEN
    RAISE EXCEPTION 'IAO outlet order total must be greater than zero';
  END IF;

  v_receipt_year := extract(year FROM v_created_at)::integer;

  INSERT INTO public.iao_outlet_order_receipt_counters (receipt_year, last_number)
  VALUES (v_receipt_year, 0)
  ON CONFLICT (receipt_year) DO NOTHING;

  UPDATE public.iao_outlet_order_receipt_counters
  SET last_number = last_number + 1
  WHERE receipt_year = v_receipt_year
  RETURNING last_number INTO v_receipt_number;

  IF v_receipt_number IS NULL THEN
    RAISE EXCEPTION 'IAO receipt counter could not be initialized';
  END IF;

  BEGIN
    INSERT INTO public.iao_outlet_orders (
      id, receipt_year, receipt_number, outlet_id,
      outlet_name_snapshot, outlet_address_snapshot, outlet_phone_snapshot,
      grand_total, created_at, created_by,
      source_pos_transaction_id, source_area_code,
      source_receipt_year, source_receipt_number
    ) VALUES (
      gen_random_uuid(), v_receipt_year, v_receipt_number, v_outlet.id,
      v_outlet.outlet_name, coalesce(v_outlet.complete_address, ''), coalesce(v_outlet.contact_number, ''),
      v_grand_total, v_created_at, auth.uid(),
      p_pos_transaction_id, v_pos.area_code,
      v_pos.receipt_year, v_pos.receipt_number
    ) RETURNING id INTO v_order_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'This POS transaction has already been copied.';
  END;

  FOR v_item IN
    SELECT product_id, product_name_snapshot, product_code_snapshot,
           unit_snapshot, unit_price, quantity
    FROM public.pos_transaction_items
    WHERE transaction_id = p_pos_transaction_id
    ORDER BY product_id
  LOOP
    v_selling_price := round((p_selling_prices ->> v_item.product_id)::numeric, 2);
    v_line_total := round(v_selling_price * v_item.quantity, 2);

    INSERT INTO public.iao_outlet_order_items (
      id, order_id, product_id, product_name_snapshot, product_code_snapshot,
      unit_snapshot, eclipse_reference_unit_price, iao_selling_unit_price,
      quantity, line_total
    ) VALUES (
      gen_random_uuid(), v_order_id, v_item.product_id, v_item.product_name_snapshot,
      v_item.product_code_snapshot, v_item.unit_snapshot, v_item.unit_price,
      v_selling_price, v_item.quantity, v_line_total
    );

    v_receipt_items := v_receipt_items || jsonb_build_array(jsonb_build_object(
      'productId', v_item.product_id,
      'productCode', v_item.product_code_snapshot,
      'productName', v_item.product_name_snapshot,
      'unit', v_item.unit_snapshot,
      'quantity', v_item.quantity,
      'eclipseReferenceUnitPrice', v_item.unit_price,
      'sellingUnitPrice', v_selling_price,
      'lineTotal', v_line_total
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'receiptNumber', v_source_receipt,
    'sourceReceipt', v_source_receipt,
    'sourcePosTransactionId', p_pos_transaction_id,
    'createdAt', v_created_at,
    'outletName', v_outlet.outlet_name,
    'outletAddress', coalesce(v_outlet.complete_address, ''),
    'outletPhone', coalesce(v_outlet.contact_number, ''),
    'items', v_receipt_items,
    'grandTotal', v_grand_total
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_iao_outlet_order_from_pos(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_iao_outlet_order_from_pos(text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_iao_outlet_order_from_pos(text, jsonb) TO authenticated;
