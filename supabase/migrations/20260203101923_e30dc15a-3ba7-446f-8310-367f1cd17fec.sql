-- Add archived_at column to action_items table for auto-archive feature
ALTER TABLE public.action_items 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster filtering on archived items
CREATE INDEX IF NOT EXISTS idx_action_items_archived_at ON public.action_items(archived_at);

-- Create function to auto-archive completed items from previous day
-- This can be called by a scheduled job or edge function
CREATE OR REPLACE FUNCTION public.archive_completed_action_items()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  archived_count INTEGER;
BEGIN
  UPDATE action_items 
  SET archived_at = NOW() 
  WHERE status = 'Completed' 
    AND archived_at IS NULL 
    AND updated_at < CURRENT_DATE;
  
  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RETURN archived_count;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.archive_completed_action_items() TO authenticated;