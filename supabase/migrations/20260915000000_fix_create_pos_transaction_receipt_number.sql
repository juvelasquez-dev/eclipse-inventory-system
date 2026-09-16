-- Fix off-by-one bug in create_pos_transaction()'s receipt-number reservation.
-- Only the RETURNING expression changes: reserve the incremented last_number
-- itself instead of (last_number - 1), so the first receipt of any new
-- area/year counter is 1, not 0 (which violated pos_transactions_receipt_number_check).
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

declare
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

begin

  -- VALIDATE CART
  if jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'POS transaction must contain at least one item';
  end if;

  -- VALIDATE PAYMENT
  -- CASH and CHEQUE are supported.
  if upper(trim(coalesce(p_payment_method, ''))) not in ('CASH', 'CHEQUE') then
    raise exception 'Only CASH and CHEQUE payment methods are currently supported';
  end if;

  if p_amount_received < 0 then
    raise exception 'Amount received cannot be negative';
  end if;

  -- VALIDATE ITEMS
  for item in
    select raw_item.product_id, raw_item.quantity
    from jsonb_to_recordset(p_items) as raw_item(product_id text, quantity bigint)
  loop
    if item.product_id is null or btrim(item.product_id) = '' then
      raise exception 'Every POS item must contain a product_id';
    end if;

    if item.quantity is null or item.quantity <= 0 then
      raise exception 'Every POS item quantity must be greater than zero';
    end if;
  end loop;

  -- LOCK PRODUCTS IN CONSISTENT ORDER
  for product_id_value in
    select distinct raw_item.product_id
    from jsonb_to_recordset(p_items) as raw_item(product_id text, quantity bigint)
    order by raw_item.product_id
  loop
    perform pg_advisory_xact_lock(
      hashtextextended(product_id_value, 0)
    );
  end loop;

  -- VALIDATE STOCK + CALCULATE TOTAL
  for item in
    select
      raw_item.product_id,
      sum(raw_item.quantity)::bigint as quantity
    from jsonb_to_recordset(p_items) as raw_item(product_id text, quantity bigint)
    group by raw_item.product_id
    order by raw_item.product_id
  loop

    begin
      select
        p.id,
        p.name,
        p.code,
        p.unit,
        p.price
      into strict product_row
      from public.products p
      where p.id = item.product_id
      for update;

    exception when no_data_found then
      raise exception 'Product not found: %', item.product_id;
    end;

    select coalesce(
      sum(
        case
          when t.type = 'IN' then t.quantity
          when t.type = 'OUT' then -t.quantity
          else t.quantity
        end
      ),
      0
    )::bigint
    into current_stock
    from public.transactions t
    where t.product_id = item.product_id;

    if current_stock < item.quantity then
      raise exception
        'Insufficient stock for product %. Available: %, requested: %',
        item.product_id,
        current_stock,
        item.quantity;
    end if;

    subtotal_amount :=
      subtotal_amount + (product_row.price * item.quantity);

    total_quantity :=
      total_quantity + item.quantity;

  end loop;

  subtotal_amount := round(subtotal_amount, 2);

  -- VALIDATE PAYMENT AMOUNT
  --
  -- CASH:
  --   Amount received must be >= total.
  --   Change is calculated normally.
  --
  -- CHEQUE:
  --   Amount received must equal the exact total.
  --   Change is always zero.
  if upper(trim(coalesce(p_payment_method, ''))) = 'CHEQUE' then

    if p_amount_received <> subtotal_amount then
      raise exception
        'For CHEQUE payment, amount received must equal the exact transaction total';
    end if;

    change_amount := 0;

  else

    if p_amount_received < subtotal_amount then
      raise exception
        'Amount received is less than the transaction total';
    end if;

    change_amount :=
      round(
        p_amount_received - subtotal_amount,
        2
      );

  end if;

  -- GET USER AREA
  select uaa.area_code
  into strict area_code_value
  from public.user_area_assignments uaa
  where uaa.user_id = auth.uid();

  -- GET CURRENT YEAR
  v_receipt_year :=
    extract(year from transaction_timestamp())::integer;

  -- CREATE AREA/YEAR COUNTER IF IT DOES NOT EXIST
  insert into public.pos_area_receipt_counters (
    area_code,
    receipt_year,
    last_number
  )
  values (
    area_code_value,
    v_receipt_year,
    0
  )
  on conflict (area_code, receipt_year) do nothing;

  -- RESERVE RECEIPT NUMBER
  update public.pos_area_receipt_counters c
  set last_number = c.last_number + 1
  where c.area_code = area_code_value
    and c.receipt_year = v_receipt_year
  returning c.last_number
  into receipt_number;

  if receipt_number is null then
    raise exception
      'Receipt counter could not be initialized for area % and year %',
      area_code_value,
      v_receipt_year;
  end if;

  display_receipt_number :=
    area_code_value || '-' || lpad(receipt_number::text, 4, '0');

  -- CREATE POS TRANSACTION
  transaction_id := gen_random_uuid();

  insert into public.pos_transactions (
    id,
    delivery_receipt_sequence,
    area_code,
    receipt_year,
    receipt_number,
    customer_name,
    customer_address,
    customer_phone,
    subtotal,
    total_amount,
    amount_received,
    change_amount,
    payment_method,
    transaction_status,
    created_at,
    created_by
  )
  values (
    transaction_id,
    null,
    area_code_value,
    v_receipt_year,
    receipt_number,
    coalesce(p_customer_name, ''),
    coalesce(p_customer_address, ''),
    coalesce(p_customer_phone, ''),
    subtotal_amount,
    subtotal_amount,
    p_amount_received,
    change_amount,
    upper(trim(p_payment_method)),
    'COMPLETED',
    now(),
    auth.uid()
  );

  -- CREATE TRANSACTION ITEMS + STOCK OUT
  for item in
    select
      raw_item.product_id,
      sum(raw_item.quantity)::bigint as quantity
    from jsonb_to_recordset(p_items) as raw_item(product_id text, quantity bigint)
    group by raw_item.product_id
    order by raw_item.product_id
  loop

    select
      p.id,
      p.name,
      p.code,
      p.unit,
      p.price
    into strict product_row
    from public.products p
    where p.id = item.product_id
    for update;

    insert into public.pos_transaction_items (
      transaction_id,
      product_id,
      product_name_snapshot,
      product_code_snapshot,
      unit_snapshot,
      quantity,
      unit_price,
      line_amount
    )
    values (
      transaction_id,
      product_row.id,
      product_row.name,
      product_row.code,
      product_row.unit,
      item.quantity,
      product_row.price,
      round(product_row.price * item.quantity, 2)
    );

    insert into public.transactions (
      id,
      product_id,
      type,
      quantity,
      date,
      remarks
    )
    values (
      gen_random_uuid()::text,
      product_row.id,
      'OUT',
      item.quantity,
      now(),
      'POS sale ' || display_receipt_number
    );

  end loop;

  return jsonb_build_object(
    'transaction_id', transaction_id,
    'delivery_receipt_sequence', null,
    'delivery_receipt_number', null,
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

end;
$function$;
