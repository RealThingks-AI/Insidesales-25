-- Create accounts table
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  website TEXT,
  industry TEXT,
  company_type TEXT,
  country TEXT,
  region TEXT,
  status TEXT DEFAULT 'New',
  tags TEXT[],
  description TEXT,
  account_owner UUID,
  created_by UUID,
  modified_by UUID,
  created_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
  modified_time TIMESTAMP WITH TIME ZONE,
  last_activity_time TIMESTAMP WITH TIME ZONE,
  currency TEXT DEFAULT 'EUR'
);

-- Enable RLS
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies (matching contacts pattern)
CREATE POLICY "Users can view all accounts"
  ON public.accounts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert accounts"
  ON public.accounts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update accounts"
  ON public.accounts FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete accounts"
  ON public.accounts FOR DELETE
  TO authenticated
  USING (true);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_account_name 
  ON public.accounts(account_name);
CREATE INDEX IF NOT EXISTS idx_accounts_account_owner 
  ON public.accounts(account_owner);
CREATE INDEX IF NOT EXISTS idx_accounts_created_time 
  ON public.accounts(created_time DESC);