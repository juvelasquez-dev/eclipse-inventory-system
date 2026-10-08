-- A) Remove TRUNCATE (not governed by RLS) from anon and authenticated on EIDMS tables.
REVOKE TRUNCATE ON TABLE
  public.audit_logs,
  public.delivery_receipt_counters,
  public.iao_outlet_order_items,
  public.iao_outlet_order_receipt_counters,
  public.iao_outlet_orders,
  public.outlets,
  public.pos_area_receipt_counters,
  public.pos_transaction_items,
  public.pos_transactions,
  public.products,
  public.transactions,
  public.user_area_assignments,
  public.users
FROM anon, authenticated;

-- B) admin_list_users must require an ACTIVE ADMIN.
-- Same signature, return columns, query, ordering, SECURITY DEFINER, and search_path
-- as 20261006153000_admin_username_change.sql; only the authorization check changes.
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  username text,
  email text,
  role text,
  status text,
  area_code text,
  profile_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.require_active_admin();

  RETURN QUERY
  SELECT
    u.username,
    u.email,
    u.role,
    u.status,
    uaa.area_code,
    u.id
  FROM public.users AS u
  LEFT JOIN auth.users AS au
    ON lower(btrim(au.email)) = lower(btrim(u.email))
  LEFT JOIN public.user_area_assignments AS uaa
    ON uaa.user_id = au.id
  ORDER BY u.username;
END;
$function$;

-- C) Only ACTIVE users may read POS transaction items (matches pos_transactions policy).
DROP POLICY IF EXISTS "Authenticated users can view POS transaction items"
  ON public.pos_transaction_items;
DROP POLICY IF EXISTS "Active users can view POS transaction items"
  ON public.pos_transaction_items;

CREATE POLICY "Active users can view POS transaction items"
ON public.pos_transaction_items
FOR SELECT
TO authenticated
USING (public.get_current_user_status() = 'ACTIVE');
