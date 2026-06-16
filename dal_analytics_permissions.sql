-- DALos Analytics Permissions Table
-- Run this in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS public.dal_analytics_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES public.users(id),
  role TEXT NOT NULL DEFAULT 'viewer',
  config JSONB NOT NULL DEFAULT '{
    "products": [],
    "dashboards": [],
    "filters": {"farms": "all", "markets": "all", "varieties": "all"},
    "tabs": []
  }',
  expires_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Auto-update updated_at on any change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dal_permissions_updated_at
  BEFORE UPDATE ON public.dal_analytics_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable Row Level Security
ALTER TABLE public.dal_analytics_permissions ENABLE ROW LEVEL SECURITY;

-- Allow anon/authenticated to read and write (adjust as needed)
CREATE POLICY "allow_all" ON public.dal_analytics_permissions
  FOR ALL USING (true) WITH CHECK (true);

-- Index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_dal_permissions_user_id
  ON public.dal_analytics_permissions(user_id);
