-- Historical IAO orders must stay viewable/reprintable after the outlet is
-- deactivated or changed. The previous definition joined public.outlets and
-- required outlet.status = 'Active' AND outlet.area_code = 'IAO', which made
-- the details lookup fail for historical orders. The function returns only
-- order/item snapshot data, so the outlet join is removed.
-- Authentication, require_active_user() and the caller's IAO area assignment
-- are unchanged. Signature, return type, security and grants are unchanged.

CREATE OR REPLACE FUNCTION public.get_iao_outlet_order_details(
  p_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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

  PERFORM public.require_active_user();

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
