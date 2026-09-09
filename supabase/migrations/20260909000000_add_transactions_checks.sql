ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('IN', 'OUT', 'ADJUSTMENT'));

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_quantity_check
  CHECK (
    (type IN ('IN', 'OUT') AND quantity > 0)
    OR
    (type = 'ADJUSTMENT' AND quantity <> 0)
  );
