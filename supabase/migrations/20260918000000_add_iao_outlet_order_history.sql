-- IAO Transaction History (read-only). Additive only: no tables are
-- altered, no existing IAO/POS/Inventory RPC or table is modified. Both
-- functions here only SELECT from public.iao_outlet_orders and
-- public.iao_outlet_order_items, which already store the historical
-- snapshots needed for listing/reprinting.

-- Paginated, searchable, filterable list of IAO outlet orders (manual and
-- POS-copied). No broad table SELECT grant is added; access is only via
-- this SECURITY DEFINER RPC, restricted to IAO-area callers.
CREATE OR REPLACE FUNCTION public.list_iao_outlet_orders(
  p_search text DEFAULT '',
  p_type text DEFAULT 'ALL',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 10
)
RETURNS TABLE (
  order_id uuid,
  order_type text,
  receipt_display text,
  outlet_name text,
  grand_total numeric,
  created_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_area_code text;
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 10), 1), 100);
  v_search text := lower(btrim(coalesce(p_search, '')));
  v_type text := upper(btrim(coalesce(p_type, 'ALL')));
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

  IF v_type NOT IN ('ALL', 'MANUAL', 'POS_COPY') THEN
    RAISE EXCEPTION 'Invalid type filter: %', p_type;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      o.id,
      CASE WHEN o.source_pos_transaction_id IS NULL THEN 'MANUAL' ELSE 'POS_COPY' END AS computed_type,
      CASE
        WHEN o.source_pos_transaction_id IS NULL
          THEN 'IAO-' || lpad(o.receipt_number::text, 4, '0')
        ELSE o.source_area_code || '-' || lpad(o.source_receipt_number::text, 4, '0')
      END AS computed_receipt,
      o.outlet_name_snapshot,
      o.grand_total,
      o.created_at
    FROM public.iao_outlet_orders o
  ), matching AS (
    SELECT *
    FROM base b
    WHERE (v_type = 'ALL' OR b.computed_type = v_type)
      AND (
        v_search = ''
        OR lower(b.outlet_name_snapshot) LIKE '%' || v_search || '%'
        OR lower(b.computed_receipt) LIKE '%' || v_search || '%'
      )
  ), totals AS (
    SELECT count(*)::bigint AS total_count
    FROM matching
  ), paged AS (
    SELECT m.*
    FROM matching m
    ORDER BY m.created_at DESC
    LIMIT v_page_size
    OFFSET (v_page - 1) * v_page_size
  ), result AS (
    SELECT
      p.id,
      p.computed_type,
      p.computed_receipt,
      p.outlet_name_snapshot,
      p.grand_total,
      p.created_at,
      t.total_count,
      0 AS row_kind
    FROM paged p
    CROSS JOIN totals t

    UNION ALL

    SELECT
      NULL::uuid,
      NULL::text,
      NULL::text,
      NULL::text,
      NULL::numeric,
      NULL::timestamptz,
      t.total_count,
      1 AS row_kind
    FROM totals t
    WHERE t.total_count > 0
      AND NOT EXISTS (SELECT 1 FROM paged)
  )
  SELECT
    r.id,
    r.computed_type,
    r.computed_receipt,
    r.outlet_name_snapshot,
    r.grand_total,
    r.created_at,
    r.total_count
  FROM result r
  ORDER BY r.row_kind, r.created_at DESC NULLS LAST;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_iao_outlet_orders(text, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_iao_outlet_orders(text, text, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_iao_outlet_orders(text, text, integer, integer) TO authenticated;


-- Full historical order + items, shaped exactly like the jsonb already
-- returned by create_iao_outlet_order / create_iao_outlet_order_from_pos,
-- so the existing IAOOutletOrderReceiptPrint component can render it
-- unchanged for both on-screen viewing and reprinting.
CREATE OR REPLACE FUNCTION public.get_iao_outlet_order_details(
  p_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_area_code text;
  v_order record;
  v_items jsonb;
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

  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'An order id is required';
  END IF;

    SELECT o.receipt_number, o.outlet_name_snapshot, o.outlet_address_snapshot,
      o.outlet_phone_snapshot, o.grand_total, o.created_at,
      o.source_pos_transaction_id, o.source_area_code,
      o.source_receipt_year, o.source_receipt_number
  INTO v_order
    FROM public.iao_outlet_orders o
    JOIN public.outlets outlet
      ON outlet.id = o.outlet_id
      AND outlet.area_code = 'IAO'
      AND outlet.status = 'Active'
    WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'IAO outlet order not found';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'productId', product_id,
        'productCode', product_code_snapshot,
        'productName', product_name_snapshot,
        'unit', unit_snapshot,
        'quantity', quantity,
        'eclipseReferenceUnitPrice', eclipse_reference_unit_price,
        'sellingUnitPrice', iao_selling_unit_price,
        'lineTotal', line_total
      )
      ORDER BY product_code_snapshot
    ),
    '[]'::jsonb
  )
  INTO v_items
  FROM public.iao_outlet_order_items
  WHERE order_id = p_order_id;

  RETURN jsonb_build_object(
    'receiptNumber', CASE
      WHEN v_order.source_pos_transaction_id IS NULL
        THEN 'IAO-' || lpad(v_order.receipt_number::text, 4, '0')
      ELSE v_order.source_area_code || '-' || lpad(v_order.source_receipt_number::text, 4, '0')
    END,
    'sourceReceipt', CASE
      WHEN v_order.source_pos_transaction_id IS NULL THEN NULL
      ELSE v_order.source_area_code || '-' || lpad(v_order.source_receipt_number::text, 4, '0')
    END,
    'sourceAreaCode', v_order.source_area_code,
    'sourceReceiptYear', v_order.source_receipt_year,
    'sourceReceiptNumber', v_order.source_receipt_number,
    'createdAt', v_order.created_at,
    'outletName', v_order.outlet_name_snapshot,
    'outletAddress', coalesce(v_order.outlet_address_snapshot, ''),
    'outletPhone', coalesce(v_order.outlet_phone_snapshot, ''),
    'items', v_items,
    'grandTotal', v_order.grand_total
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_iao_outlet_order_details(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_iao_outlet_order_details(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_iao_outlet_order_details(uuid) TO authenticated;
