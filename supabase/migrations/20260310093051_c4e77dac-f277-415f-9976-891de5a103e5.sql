ALTER TABLE notification_preferences 
  ADD COLUMN IF NOT EXISTS daily_reminder_time text DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at date;