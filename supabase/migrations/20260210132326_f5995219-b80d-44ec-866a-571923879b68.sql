
-- Create backups table
CREATE TABLE public.backups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name text NOT NULL,
  file_path text NOT NULL,
  size_bytes bigint DEFAULT 0,
  tables_count integer DEFAULT 0,
  records_count integer DEFAULT 0,
  backup_type text NOT NULL DEFAULT 'manual',
  module_name text,
  status text NOT NULL DEFAULT 'in_progress',
  manifest jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Create backup_schedules table
CREATE TABLE public.backup_schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  frequency text NOT NULL DEFAULT 'every_2_days',
  time_of_day text NOT NULL DEFAULT '00:00',
  is_enabled boolean NOT NULL DEFAULT false,
  next_run_at timestamptz,
  last_run_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_schedules ENABLE ROW LEVEL SECURITY;

-- RLS policies for backups - admin only
CREATE POLICY "Admins can view all backups"
  ON public.backups FOR SELECT
  USING (is_user_admin());

CREATE POLICY "Admins can insert backups"
  ON public.backups FOR INSERT
  WITH CHECK (is_user_admin());

CREATE POLICY "Admins can update backups"
  ON public.backups FOR UPDATE
  USING (is_user_admin());

CREATE POLICY "Admins can delete backups"
  ON public.backups FOR DELETE
  USING (is_user_admin());

-- RLS policies for backup_schedules - admin only
CREATE POLICY "Admins can view backup schedules"
  ON public.backup_schedules FOR SELECT
  USING (is_user_admin());

CREATE POLICY "Admins can insert backup schedules"
  ON public.backup_schedules FOR INSERT
  WITH CHECK (is_user_admin());

CREATE POLICY "Admins can update backup schedules"
  ON public.backup_schedules FOR UPDATE
  USING (is_user_admin());

CREATE POLICY "Admins can delete backup schedules"
  ON public.backup_schedules FOR DELETE
  USING (is_user_admin());

-- Create private backups storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false);

-- Storage RLS policies - admin only
CREATE POLICY "Admins can read backup files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'backups' AND (SELECT is_user_admin()));

CREATE POLICY "Admins can upload backup files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'backups' AND (SELECT is_user_admin()));

CREATE POLICY "Admins can update backup files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'backups' AND (SELECT is_user_admin()));

CREATE POLICY "Admins can delete backup files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'backups' AND (SELECT is_user_admin()));

-- Trigger for backup_schedules updated_at
CREATE TRIGGER update_backup_schedules_updated_at
  BEFORE UPDATE ON public.backup_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
