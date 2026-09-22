ALTER TABLE public.pos_transactions
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

CREATE OR REPLACE FUNCTION public.cancel_pos_transaction(
  p_transaction_id text,
  p_cancellation_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_pos record;
  v_item record;
  v_caller_area text;
  v_display_receipt_number text;
  v_cancelled_at timestamptz := now();
  v_restored_item_count integer := 0;
  v_restored_quantity bigint := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  IF p_transaction_id IS NULL OR btrim(p_transaction_id) = '' THEN
    RAISE EXCEPTION 'POS transaction ID is required';
  END IF;

  SELECT area_code
  INTO STRICT v_caller_area
  FROM public.user_area_assignments
  WHERE user_id = auth.uid();

  SELECT
    id,
    area_code,
    receipt_number,
    delivery_receipt_sequence,
    transaction_status
  INTO v_pos
  FROM public.pos_transactions
  WHERE id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POS transaction not found';
  END IF;

  IF v_pos.transaction_status <> 'COMPLETED' THEN
    RAISE EXCEPTION 'Only completed POS transactions can be cancelled';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.iao_outlet_orders
    WHERE source_pos_transaction_id = p_transaction_id
  ) THEN
    RAISE EXCEPTION 'This POS transaction cannot be cancelled because it has already been copied to an IAO outlet order';
  END IF;

  FOR v_item IN
    SELECT DISTINCT product_id
    FROM public.pos_transaction_items
    WHERE transaction_id = p_transaction_id
    ORDER BY product_id
  LOOP
    PERFORM pg_advisory_xact_lock(
      hashtextextended(v_item.product_id, 0)
    );
  END LOOP;

  FOR v_item IN
    SELECT product_id, quantity
    FROM public.pos_transaction_items
    WHERE transaction_id = p_transaction_id
    ORDER BY product_id
  LOOP
    PERFORM 1
    FROM public.products
    WHERE id = v_item.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found: %', v_item.product_id;
    END IF;

    v_restored_item_count := v_restored_item_count + 1;
    v_restored_quantity := v_restored_quantity + v_item.quantity;
  END LOOP;

  IF v_restored_item_count = 0 THEN
    RAISE EXCEPTION 'POS transaction has no items to restore';
  END IF;

  v_display_receipt_number := CASE
    WHEN v_pos.area_code IS NOT NULL AND v_pos.receipt_number IS NOT NULL THEN
      v_pos.area_code || '-' || lpad(v_pos.receipt_number::text, 4, '0')
    WHEN v_pos.delivery_receipt_sequence IS NOT NULL THEN
      'DR-' || lpad(v_pos.delivery_receipt_sequence::text, 4, '0')
    ELSE '-'
  END;

  FOR v_item IN
    SELECT product_id, quantity
    FROM public.pos_transaction_items
    WHERE transaction_id = p_transaction_id
    ORDER BY product_id
  LOOP
    INSERT INTO public.transactions (
      id,
      product_id,
      type,
      quantity,
      date,
      remarks
    )
    VALUES (
      gen_random_uuid()::text,
      v_item.product_id,
      'ADJUSTMENT',
      v_item.quantity,
      v_cancelled_at,
      'POS cancellation ' || v_display_receipt_number
    );
  END LOOP;

  UPDATE public.pos_transactions
  SET
    transaction_status = 'CANCELLED',
    cancelled_at = v_cancelled_at,
    cancelled_by = auth.uid(),
    cancellation_reason = nullif(btrim(p_cancellation_reason), '')
  WHERE id = p_transaction_id;

  RETURN jsonb_build_object(
    'transaction_id', p_transaction_id,
    'display_receipt_number', v_display_receipt_number,
    'transaction_status', 'CANCELLED',
    'cancelled_at', v_cancelled_at,
    'restored_item_count', v_restored_item_count,
    'restored_quantity', v_restored_quantity
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_pos_transaction(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_pos_transaction(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_pos_transaction(text, text) TO authenticated;