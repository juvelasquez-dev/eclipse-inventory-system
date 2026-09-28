ALTER TABLE public.products
  ADD CONSTRAINT products_price_nonnegative_check
    CHECK (price >= 0),
  ADD CONSTRAINT products_minimum_stock_nonnegative_check
    CHECK (minimum_stock >= 0),
  ADD CONSTRAINT products_code_nonblank_check
    CHECK (btrim(code) <> ''),
  ADD CONSTRAINT products_name_nonblank_check
    CHECK (btrim(name) <> ''),
  ADD CONSTRAINT products_category_nonblank_check
    CHECK (btrim(category) <> ''),
  ADD CONSTRAINT products_unit_nonblank_check
    CHECK (btrim(unit) <> '');

CREATE UNIQUE INDEX products_normalized_code_unique_idx
  ON public.products (lower(btrim(code)));
