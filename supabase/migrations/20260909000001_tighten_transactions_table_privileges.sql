REVOKE ALL PRIVILEGES ON TABLE public.transactions FROM anon, authenticated;

GRANT SELECT, INSERT ON TABLE public.transactions TO authenticated;
