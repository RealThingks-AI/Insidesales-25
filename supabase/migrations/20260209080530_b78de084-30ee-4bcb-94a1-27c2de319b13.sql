-- Phase 1.1: Extend profiles table with phone, timezone, avatar_url
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Kolkata';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Phase 1.2: Extend user_preferences table with display settings
ALTER TABLE user_preferences 
ADD COLUMN IF NOT EXISTS date_format TEXT DEFAULT 'DD/MM/YYYY',
ADD COLUMN IF NOT EXISTS time_format TEXT DEFAULT '12h',
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR',
ADD COLUMN IF NOT EXISTS default_module TEXT DEFAULT 'dashboard';

-- Phase 1.3: Create notification_preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email_notifications BOOLEAN DEFAULT true,
  in_app_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT false,
  lead_assigned BOOLEAN DEFAULT true,
  deal_updates BOOLEAN DEFAULT true,
  task_reminders BOOLEAN DEFAULT true,
  meeting_reminders BOOLEAN DEFAULT true,
  weekly_digest BOOLEAN DEFAULT false,
  notification_frequency TEXT DEFAULT 'instant',
  leads_notifications BOOLEAN DEFAULT true,
  contacts_notifications BOOLEAN DEFAULT true,
  accounts_notifications BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on notification_preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification_preferences
CREATE POLICY "Users can view own notification preferences"
ON notification_preferences FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
ON notification_preferences FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
ON notification_preferences FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Phase 1.4: Create page_permissions table
CREATE TABLE IF NOT EXISTS page_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_name TEXT NOT NULL,
  description TEXT,
  route TEXT NOT NULL UNIQUE,
  admin_access BOOLEAN DEFAULT true,
  manager_access BOOLEAN DEFAULT true,
  user_access BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on page_permissions
ALTER TABLE page_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for page_permissions
CREATE POLICY "All authenticated users can view page permissions"
ON page_permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can update page permissions"
ON page_permissions FOR UPDATE TO authenticated
USING (public.is_current_user_admin());

-- Insert default page permissions
INSERT INTO page_permissions (page_name, description, route, admin_access, manager_access, user_access) VALUES
('Dashboard', 'Main dashboard with analytics', '/dashboard', true, true, true),
('Leads', 'Lead management', '/leads', true, true, true),
('Deals', 'Deal pipeline', '/deals', true, true, true),
('Contacts', 'Contact management', '/contacts', true, true, true),
('Accounts', 'Account management', '/accounts', true, true, true),
('Tasks', 'Action items and tasks', '/action-items', true, true, true),
('Notifications', 'User notifications', '/notifications', true, true, true),
('Settings', 'Application settings', '/settings', true, true, true)
ON CONFLICT (route) DO NOTHING;

-- Phase 1.5: Create user_sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_token TEXT NOT NULL,
  user_agent TEXT,
  device_info JSONB,
  is_active BOOLEAN DEFAULT true,
  last_active_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on user_sessions
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_sessions
CREATE POLICY "Users can view own sessions"
ON user_sessions FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
ON user_sessions FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
ON user_sessions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
ON user_sessions FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Create trigger for updating notification_preferences updated_at
CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON notification_preferences
FOR EACH ROW
EXECUTE FUNCTION update_notification_preferences_updated_at();

-- Create trigger for updating page_permissions updated_at
CREATE OR REPLACE FUNCTION update_page_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_page_permissions_updated_at
BEFORE UPDATE ON page_permissions
FOR EACH ROW
EXECUTE FUNCTION update_page_permissions_updated_at();