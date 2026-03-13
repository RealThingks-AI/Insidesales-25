-- Create notification function for unified action_items table
CREATE OR REPLACE FUNCTION public.create_unified_action_item_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  record_name TEXT;
  message_text TEXT;
  notification_type TEXT := 'action_item';
BEGIN
  -- Get record name based on module_type
  IF COALESCE(NEW.module_type, OLD.module_type) = 'deals' THEN
    SELECT deal_name INTO record_name
    FROM deals
    WHERE id = COALESCE(NEW.module_id, OLD.module_id);
  ELSIF COALESCE(NEW.module_type, OLD.module_type) = 'leads' THEN
    SELECT lead_name INTO record_name
    FROM leads
    WHERE id = COALESCE(NEW.module_id, OLD.module_id);
  ELSIF COALESCE(NEW.module_type, OLD.module_type) = 'contacts' THEN
    SELECT contact_name INTO record_name
    FROM contacts
    WHERE id = COALESCE(NEW.module_id, OLD.module_id);
  END IF;

  -- Handle INSERT: notify assignee if different from creator
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != NEW.created_by THEN
      message_text := 'New action item assigned: ' || NEW.title;
      IF record_name IS NOT NULL THEN
        message_text := message_text || ' (for ' || COALESCE(NEW.module_type, '') || ': ' || record_name || ')';
      END IF;
      
      INSERT INTO public.notifications (user_id, message, notification_type, action_item_id)
      VALUES (NEW.assigned_to, message_text, notification_type, NEW.id);
    END IF;
    
  -- Handle UPDATE
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check if assignee changed: notify new assignee
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to AND NEW.assigned_to IS NOT NULL THEN
      message_text := 'Action item assigned to you: ' || NEW.title;
      IF record_name IS NOT NULL THEN
        message_text := message_text || ' (for ' || COALESCE(NEW.module_type, '') || ': ' || record_name || ')';
      END IF;
      
      -- Only notify if new assignee is not the person making the change
      IF NEW.assigned_to != auth.uid() THEN
        INSERT INTO public.notifications (user_id, message, notification_type, action_item_id)
        VALUES (NEW.assigned_to, message_text, notification_type, NEW.id);
      END IF;
    END IF;
    
    -- Check if status changed to Completed: notify creator
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'Completed' THEN
      -- Only notify creator if they didn't complete it themselves
      IF NEW.created_by IS NOT NULL AND NEW.created_by != auth.uid() THEN
        message_text := 'Action item completed: ' || NEW.title;
        IF record_name IS NOT NULL THEN
          message_text := message_text || ' (for ' || COALESCE(NEW.module_type, '') || ': ' || record_name || ')';
        END IF;
        
        INSERT INTO public.notifications (user_id, message, notification_type, action_item_id)
        VALUES (NEW.created_by, message_text, notification_type, NEW.id);
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Create trigger for action_items notifications
DROP TRIGGER IF EXISTS unified_action_item_notification_trigger ON public.action_items;
CREATE TRIGGER unified_action_item_notification_trigger
  AFTER INSERT OR UPDATE ON public.action_items
  FOR EACH ROW EXECUTE FUNCTION create_unified_action_item_notification();