DROP POLICY IF EXISTS "Anyone can insert search history" ON public.search_history;
REVOKE INSERT ON public.search_history FROM anon, authenticated;
GRANT ALL ON public.search_history TO service_role;