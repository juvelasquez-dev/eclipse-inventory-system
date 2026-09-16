-- Isolated IAO outlet-order feature. It does not change POS, inventory,
-- products, outlets, transactions, or any existing receipt counter.

CREATE TABLE public.iao_outlet_order_receipt_counters (
  receipt_year integer PRIMARY KEY,
  last_number bigint NOT NULL DEFAULT 0,
  CONSTRAINT iao_outlet_order_receipt_counters_year_check
    CHECK (receipt_year >= 2000),
  CONSTRAINT iao_outlet_order_receipt_counters_last_number_check
    CHECK (last_number >= 0)
);

CREATE TABLE public.iao_outlet_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_year integer NOT NULL,
  receipt_number bigint NOT NULL,
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE RESTRICT,
  outlet_name_snapshot text NOT NULL,
  outlet_address_snapshot text NOT NULL DEFAULT '',
  outlet_phone_snapshot text NOT NULL DEFAULT '',
  grand_total numeric(14, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  CONSTRAINT iao_outlet_orders_receipt_number_check CHECK (receipt_number > 0),
  CONSTRAINT iao_outlet_orders_grand_total_check CHECK (grand_total > 0),
  CONSTRAINT iao_outlet_orders_receipt_unique UNIQUE (receipt_year, receipt_number)
);

CREATE TABLE public.iao_outlet_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.iao_outlet_orders(id) ON DELETE RESTRICT,
  product_id text NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name_snapshot text NOT NULL,
  product_code_snapshot text NOT NULL,
  unit_snapshot text NOT NULL,
  eclipse_reference_unit_price numeric(14, 2) NOT NULL,
  iao_selling_unit_price numeric(14, 2) NOT NULL,
  quantity bigint NOT NULL,
  line_total numeric(14, 2) NOT NULL,
  CONSTRAINT iao_outlet_order_items_quantity_check CHECK (quantity > 0),
  CONSTRAINT iao_outlet_order_items_reference_price_check CHECK (eclipse_reference_unit_price >= 0),
  CONSTRAINT iao_outlet_order_items_selling_price_check CHECK (iao_selling_unit_price > 0),
  CONSTRAINT iao_outlet_order_items_line_total_check CHECK (line_total > 0),
  CONSTRAINT iao_outlet_order_items_order_product_unique UNIQUE (order_id, product_id)
);

CREATE INDEX iao_outlet_orders_created_at_idx
  ON public.iao_outlet_orders (created_at DESC);

CREATE INDEX iao_outlet_orders_outlet_id_idx
  ON public.iao_outlet_orders (outlet_id);

CREATE INDEX iao_outlet_order_items_order_id_idx
  ON public.iao_outlet_order_items (order_id);

ALTER TABLE public.iao_outlet_order_receipt_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iao_outlet_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.iao_outlet_order_items ENABLE ROW LEVEL SECURITY;

-- No direct client table policies are created. IAO orders are written only
-- through the validated RPC below, and receipts are returned by that RPC.
REVOKE ALL PRIVILEGES ON TABLE public.iao_outlet_order_receipt_counters FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.iao_outlet_orders FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.iao_outlet_order_items FROM anon, authenticated;


-- The UI uses this to render the IAO-only System card and route guard.
CREATE OR REPLACE FUNCTION public.get_current_user_area_code()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT area_code
  FROM public.user_area_assignments
  WHERE user_id = auth.uid();
$function$;

REVOKE ALL ON FUNCTION public.get_current_user_area_code() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_current_user_area_code() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_current_user_area_code() TO authenticated;


CREATE OR REPLACE FUNCTION public.create_iao_outlet_order(
  p_outlet_id uuid,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_area_code text;
  v_outlet record;
  v_product record;
  v_item record;
  v_order_id uuid;
  v_receipt_year integer;
  v_receipt_number bigint;
  v_grand_total numeric(14, 2) := 0;
  v_line_total numeric(14, 2);
  v_normalized_selling_price numeric(14, 2);
  v_created_at timestamptz := transaction_timestamp();
  v_receipt_items jsonb := '[]'::jsonb;
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

  IF p_outlet_id IS NULL THEN
    RAISE EXCEPTION 'An outlet is required';
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'IAO outlet order must contain at least one item';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_items) AS raw_item(
      product_id text,
      quantity bigint,
      iao_selling_unit_price numeric
    )
    WHERE product_id IS NULL
      OR btrim(product_id) = ''
      OR quantity IS NULL
      OR quantity <= 0
      OR iao_selling_unit_price IS NULL
      OR iao_selling_unit_price <= 0
  ) THEN
    RAISE EXCEPTION 'Every item requires an existing product, quantity greater than zero, and IAO selling price greater than zero';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_items) AS raw_item(product_id text)
    GROUP BY product_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Each product may appear only once in an IAO outlet order';
  END IF;

  SELECT outlet_name, complete_address, contact_number
  INTO v_outlet
  FROM public.outlets
  WHERE id = p_outlet_id
    AND area_code = 'IAO'
    AND status = 'Active'
  FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected outlet must be an active IAO outlet';
  END IF;

  -- Calculate from database product data and supplied IAO selling prices.
  -- products.price is read only and copied into an immutable item snapshot.
  FOR v_item IN
    SELECT product_id, quantity, iao_selling_unit_price
    FROM jsonb_to_recordset(p_items) AS raw_item(
      product_id text,
      quantity bigint,
      iao_selling_unit_price numeric
    )
    ORDER BY product_id
  LOOP
    SELECT id, name, code, unit, price
    INTO v_product
    FROM public.products
    WHERE id = v_item.product_id
    FOR KEY SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found: %', v_item.product_id;
    END IF;

    v_normalized_selling_price := round(
      v_item.iao_selling_unit_price,
      2
    );

    IF v_normalized_selling_price <= 0 THEN
      RAISE EXCEPTION 'IAO selling price must round to greater than zero';
    END IF;

    v_line_total := round(
      v_normalized_selling_price * v_item.quantity,
      2
    );
    v_grand_total := v_grand_total + v_line_total;
  END LOOP;

  v_grand_total := round(v_grand_total, 2);
  IF v_grand_total <= 0 THEN
    RAISE EXCEPTION 'IAO outlet order total must be greater than zero';
  END IF;

  v_receipt_year := extract(year FROM v_created_at)::integer;

  INSERT INTO public.iao_outlet_order_receipt_counters (
    receipt_year,
    last_number
  ) VALUES (
    v_receipt_year,
    0
  ) ON CONFLICT (receipt_year) DO NOTHING;

  UPDATE public.iao_outlet_order_receipt_counters
  SET last_number = last_number + 1
  WHERE receipt_year = v_receipt_year
  RETURNING last_number INTO v_receipt_number;

  IF v_receipt_number IS NULL THEN
    RAISE EXCEPTION 'IAO receipt counter could not be initialized';
  END IF;

  INSERT INTO public.iao_outlet_orders (
    id, receipt_year, receipt_number, outlet_id,
    outlet_name_snapshot, outlet_address_snapshot, outlet_phone_snapshot,
    grand_total, created_at, created_by
  ) VALUES (
    gen_random_uuid(), v_receipt_year, v_receipt_number, p_outlet_id,
    v_outlet.outlet_name, coalesce(v_outlet.complete_address, ''), coalesce(v_outlet.contact_number, ''),
    v_grand_total, v_created_at, auth.uid()
  ) RETURNING id INTO v_order_id;

  FOR v_item IN
    SELECT product_id, quantity, iao_selling_unit_price
    FROM jsonb_to_recordset(p_items) AS raw_item(
      product_id text,
      quantity bigint,
      iao_selling_unit_price numeric
    )
    ORDER BY product_id
  LOOP
    SELECT id, name, code, unit, price
    INTO v_product
    FROM public.products
    WHERE id = v_item.product_id
    FOR KEY SHARE;

    v_normalized_selling_price := round(
      v_item.iao_selling_unit_price,
      2
    );

    v_line_total := round(
      v_normalized_selling_price * v_item.quantity,
      2
    );

    INSERT INTO public.iao_outlet_order_items (
      order_id, product_id, product_name_snapshot, product_code_snapshot,
      unit_snapshot, eclipse_reference_unit_price, iao_selling_unit_price,
      quantity, line_total
    ) VALUES (
      v_order_id, v_product.id, v_product.name, v_product.code,
      v_product.unit, v_product.price, v_normalized_selling_price,
      v_item.quantity, v_line_total
    );

    v_receipt_items := v_receipt_items || jsonb_build_array(jsonb_build_object(
      'productId', v_product.id,
      'productCode', v_product.code,
      'productName', v_product.name,
      'unit', v_product.unit,
      'quantity', v_item.quantity,
      'sellingUnitPrice', v_normalized_selling_price,
      'lineTotal', v_line_total
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'receiptNumber', 'IAO-' || lpad(v_receipt_number::text, 4, '0'),
    'createdAt', v_created_at,
    'outletName', v_outlet.outlet_name,
    'outletAddress', coalesce(v_outlet.complete_address, ''),
    'outletPhone', coalesce(v_outlet.contact_number, ''),
    'items', v_receipt_items,
    'grandTotal', v_grand_total
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_iao_outlet_order(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_iao_outlet_order(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_iao_outlet_order(uuid, jsonb) TO authenticated;
