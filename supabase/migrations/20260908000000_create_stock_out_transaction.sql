CREATE OR REPLACE FUNCTION public.create_stock_out_transaction(
  p_transaction_id text,
  p_product_id text,
  p_quantity bigint,
  p_date timestamptz,
  p_remarks text DEFAULT ''
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
  IF p_transaction_id IS NULL OR btrim(p_transaction_id) = '' THEN
    RAISE EXCEPTION 'Transaction ID is required';
  END IF;

  IF p_product_id IS NULL OR btrim(p_product_id) = '' THEN
    RAISE EXCEPTION 'Product ID is required';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Stock Out quantity must be greater than zero';
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

  SELECT
    COALESCE(
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

  IF current_stock < p_quantity THEN
    RAISE EXCEPTION
      'Insufficient stock for product %. Available: %, requested: %',
      p_product_id,
      current_stock,
      p_quantity;
  END IF;

  RETURN QUERY
  INSERT INTO public.transactions (
  id,
  product_id,
  type,
  quantity,
  date,
  remarks
)
  VALUES (
    p_transaction_id,
    p_product_id,
    'OUT',
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

REVOKE ALL ON FUNCTION public.create_stock_out_transaction(
  text,
  text,
  bigint,
  timestamptz,
  text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.create_stock_out_transaction(
  text,
  text,
  bigint,
  timestamptz,
  text
) FROM anon;

REVOKE ALL ON FUNCTION public.create_stock_out_transaction(
  text,
  text,
  bigint,
  timestamptz,
  text
) FROM service_role;

GRANT EXECUTE ON FUNCTION public.create_stock_out_transaction(
  text,
  text,
  bigint,
  timestamptz,
  text
) TO authenticated;