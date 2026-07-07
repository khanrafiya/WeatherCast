CREATE TABLE public.search_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city TEXT NOT NULL,
  temperature NUMERIC NOT NULL,
  humidity NUMERIC NOT NULL,
  description TEXT NOT NULL,
  searched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.search_history TO anon, authenticated;
GRANT ALL ON public.search_history TO service_role;
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view search history" ON public.search_history FOR SELECT USING (true);
CREATE POLICY "Anyone can insert search history" ON public.search_history FOR INSERT WITH CHECK (true);
CREATE INDEX idx_search_history_searched_at ON public.search_history(searched_at DESC);