
-- 1. campaigns table
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name text NOT NULL,
  description text,
  campaign_type text DEFAULT 'Email',
  status text DEFAULT 'Draft',
  owner uuid,
  start_date date,
  end_date date,
  region text,
  country text,
  target_audience text,
  message_strategy text,
  created_by uuid NOT NULL,
  modified_by uuid,
  created_at timestamptz DEFAULT now(),
  modified_at timestamptz DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all campaigns" ON public.campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert campaigns" ON public.campaigns FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator or admin can update campaigns" ON public.campaigns FOR UPDATE TO authenticated USING (is_user_admin() OR created_by = auth.uid());
CREATE POLICY "Creator or admin can delete campaigns" ON public.campaigns FOR DELETE TO authenticated USING (is_user_admin() OR created_by = auth.uid());

-- 2. campaign_accounts junction table
CREATE TABLE public.campaign_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  status text DEFAULT 'Not Contacted',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, account_id)
);

ALTER TABLE public.campaign_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view campaign accounts" ON public.campaign_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert campaign accounts" ON public.campaign_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator or admin can update campaign accounts" ON public.campaign_accounts FOR UPDATE TO authenticated USING (is_user_admin() OR created_by = auth.uid());
CREATE POLICY "Creator or admin can delete campaign accounts" ON public.campaign_accounts FOR DELETE TO authenticated USING (is_user_admin() OR created_by = auth.uid());

-- 3. campaign_contacts junction table
CREATE TABLE public.campaign_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  stage text DEFAULT 'Not Contacted',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, contact_id)
);

ALTER TABLE public.campaign_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view campaign contacts" ON public.campaign_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert campaign contacts" ON public.campaign_contacts FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator or admin can update campaign contacts" ON public.campaign_contacts FOR UPDATE TO authenticated USING (is_user_admin() OR created_by = auth.uid());
CREATE POLICY "Creator or admin can delete campaign contacts" ON public.campaign_contacts FOR DELETE TO authenticated USING (is_user_admin() OR created_by = auth.uid());

-- 4. campaign_communications table
CREATE TABLE public.campaign_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  communication_type text NOT NULL,
  subject text,
  body text,
  email_type text,
  email_status text,
  linkedin_status text,
  call_outcome text,
  notes text,
  outcome text,
  owner uuid,
  communication_date timestamptz DEFAULT now(),
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.campaign_communications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view campaign communications" ON public.campaign_communications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert campaign communications" ON public.campaign_communications FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator or admin can update campaign communications" ON public.campaign_communications FOR UPDATE TO authenticated USING (is_user_admin() OR created_by = auth.uid());
CREATE POLICY "Creator or admin can delete campaign communications" ON public.campaign_communications FOR DELETE TO authenticated USING (is_user_admin() OR created_by = auth.uid());

-- 5. campaign_materials table
CREATE TABLE public.campaign_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.campaign_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view campaign materials" ON public.campaign_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert campaign materials" ON public.campaign_materials FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator or admin can update campaign materials" ON public.campaign_materials FOR UPDATE TO authenticated USING (is_user_admin() OR created_by = auth.uid());
CREATE POLICY "Creator or admin can delete campaign materials" ON public.campaign_materials FOR DELETE TO authenticated USING (is_user_admin() OR created_by = auth.uid());

-- 6. campaign_email_templates table
CREATE TABLE public.campaign_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  template_name text NOT NULL,
  subject text,
  body text,
  email_type text,
  audience_segment text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.campaign_email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view campaign email templates" ON public.campaign_email_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert campaign email templates" ON public.campaign_email_templates FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator or admin can update campaign email templates" ON public.campaign_email_templates FOR UPDATE TO authenticated USING (is_user_admin() OR created_by = auth.uid());
CREATE POLICY "Creator or admin can delete campaign email templates" ON public.campaign_email_templates FOR DELETE TO authenticated USING (is_user_admin() OR created_by = auth.uid());

-- 7. campaign_phone_scripts table
CREATE TABLE public.campaign_phone_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  script_name text,
  opening_script text,
  key_talking_points text,
  discovery_questions text,
  objection_handling text,
  audience_segment text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.campaign_phone_scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view campaign phone scripts" ON public.campaign_phone_scripts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert campaign phone scripts" ON public.campaign_phone_scripts FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator or admin can update campaign phone scripts" ON public.campaign_phone_scripts FOR UPDATE TO authenticated USING (is_user_admin() OR created_by = auth.uid());
CREATE POLICY "Creator or admin can delete campaign phone scripts" ON public.campaign_phone_scripts FOR DELETE TO authenticated USING (is_user_admin() OR created_by = auth.uid());

-- 8. Add campaign_id to deals for attribution
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL;

-- 9. Storage bucket for campaign materials
INSERT INTO storage.buckets (id, name, public) VALUES ('campaign-materials', 'campaign-materials', false);

CREATE POLICY "Authenticated users can upload campaign materials" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'campaign-materials');
CREATE POLICY "Authenticated users can view campaign materials" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'campaign-materials');
CREATE POLICY "Users can delete their own campaign materials" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'campaign-materials' AND (auth.uid()::text = (storage.foldername(name))[1]));
