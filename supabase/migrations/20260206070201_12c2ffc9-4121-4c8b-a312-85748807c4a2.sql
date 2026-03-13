-- Add last_activity_time column to contacts table for Zoho CRM compatibility
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS last_activity_time timestamp with time zone;