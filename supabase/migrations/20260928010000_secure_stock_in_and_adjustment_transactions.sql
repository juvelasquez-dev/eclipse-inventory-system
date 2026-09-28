CREATE OR REPLACE FUNCTION public.create_stock_in_transaction(
  p_product_id text,
  p_quantity bigint,
  p_date timestamptz,
  p_remarks text
)
RETURNS TABLE (
  id text,
  product_id text,
  type text,
  quantity bigint,
  date timestamptz,
  remarks text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  IF p_product_id IS NULL OR btrim(p_product_id) = '' THEN
    RAISE EXCEPTION 'Product ID is required';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Stock In quantity must be greater than zero';
  END IF;

  IF p_date IS NULL THEN
    RAISE EXCEPTION 'Transaction date is required';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_product_id, 0)
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.products
    WHERE products.id = p_product_id
  ) THEN
    RAISE EXCEPTION 'Product not found: %', p_product_id;
  END IF;

  RETURN QUERY
  INSERT INTO public.transactions (
    id,
    product_id,
    type,
    quantity,
    date,
    remarks
  ) VALUES (
    gen_random_uuid()::text,
    p_product_id,
    'IN',
    p_quantity,
    p_date,
    COALESCE(p_remarks, '')
  )
  RETURNING
    transactions.id,
    transactions.product_id,
    transactions.type,
    transactions.quantity,
    transactions.date,
    transactions.remarks;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_stock_in_transaction(text, bigint, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_stock_in_transaction(text, bigint, timestamptz, text) FROM anon;
REVOKE ALL ON FUNCTION public.create_stock_in_transaction(text, bigint, timestamptz, text) FROM service_role;
GRANT EXECUTE ON FUNCTION public.create_stock_in_transaction(text, bigint, timestamptz, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.create_stock_adjustment_transaction(
  p_product_id text,
  p_quantity bigint,
  p_date timestamptz,
  p_remarks text
)
RETURNS TABLE (
  id text,
  product_id text,
  type text,
  quantity bigint,
  date timestamptz,
  remarks text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  current_stock bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  IF p_product_id IS NULL OR btrim(p_product_id) = '' THEN
    RAISE EXCEPTION 'Product ID is required';
  END IF;

  IF p_quantity IS NULL OR p_quantity = 0 THEN
    RAISE EXCEPTION 'Adjustment quantity must not be zero';
  END IF;

  IF p_date IS NULL THEN
    RAISE EXCEPTION 'Transaction date is required';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_product_id, 0)
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.products
    WHERE products.id = p_product_id
  ) THEN
    RAISE EXCEPTION 'Product not found: %', p_product_id;
  END IF;

  SELECT COALESCE(
    SUM(
      CASE
        WHEN transactions.type = 'IN' THEN transactions.quantity
        WHEN transactions.type = 'OUT' THEN -transactions.quantity
        ELSE transactions.quantity
      END
    ),
    0
  )::bigint
  INTO current_stock
  FROM public.transactions
  WHERE transactions.product_id = p_product_id;

  IF p_quantity < 0 AND current_stock + p_quantity < 0 THEN
    RAISE EXCEPTION
      'Insufficient stock for adjustment. Available: %, requested: %',
      current_stock,
      abs(p_quantity);
  END IF;

  RETURN QUERY
  INSERT INTO public.transactions (
    id,
    product_id,
    type,
    quantity,
    date,
    remarks
  ) VALUES (
    gen_random_uuid()::text,
    p_product_id,
    'ADJUSTMENT',
    p_quantity,
    p_date,
    COALESCE(p_remarks, '')
  )
  RETURNING
    transactions.id,
    transactions.product_id,
    transactions.type,
    transactions.quantity,
    transactions.date,
    transactions.remarks;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_stock_adjustment_transaction(text, bigint, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_stock_adjustment_transaction(text, bigint, timestamptz, text) FROM anon;
REVOKE ALL ON FUNCTION public.create_stock_adjustment_transaction(text, bigint, timestamptz, text) FROM service_role;
GRANT EXECUTE ON FUNCTION public.create_stock_adjustment_transaction(text, bigint, timestamptz, text) TO authenticated;


REVOKE INSERT ON TABLE public.transactions FROM authenticated;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.transactions;