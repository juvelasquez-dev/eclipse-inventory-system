REVOKE ALL PRIVILEGES ON TABLE public.products FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.products
TO authenticated;
