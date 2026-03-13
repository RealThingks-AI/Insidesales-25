
CREATE TABLE public.campaign_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value text NOT NULL,
  updated_by uuid,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.campaign_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view campaign settings"
  ON public.campaign_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert campaign settings"
  ON public.campaign_settings FOR INSERT TO authenticated
  WITH CHECK (is_user_admin());

CREATE POLICY "Admins can update campaign settings"
  ON public.campaign_settings FOR UPDATE TO authenticated
  USING (is_user_admin());

-- Seed default values
INSERT INTO public.campaign_settings (setting_key, setting_value) VALUES
  ('follow_up_days', '3'),
  ('max_follow_ups', '3');
