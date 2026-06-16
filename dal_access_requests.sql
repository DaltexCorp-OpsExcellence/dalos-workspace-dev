-- DALos Analytics Access Requests Table
-- Run this in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS public.dal_access_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  product TEXT NOT NULL DEFAULT 'grapes',
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, declined
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ DEFAULT NULL,
  reviewed_by UUID REFERENCES public.users(id),
  UNIQUE(user_id, product)
);

ALTER TABLE public.dal_access_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON public.dal_access_requests FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_access_requests_user ON public.dal_access_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON public.dal_access_requests(status);
