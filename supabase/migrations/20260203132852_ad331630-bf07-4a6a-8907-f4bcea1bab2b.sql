-- Part 1: Fix RLS Policy for Notifications
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;

CREATE POLICY "System can insert notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (true);

-- Part 2: Disable Legacy Triggers (correct syntax without IF EXISTS)
ALTER TABLE public.lead_action_items DISABLE TRIGGER action_item_notification_trigger;
ALTER TABLE public.deal_action_items DISABLE TRIGGER deal_action_item_notification_trigger;

-- Part 3: Add Module Reference Columns to notifications table
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS module_type TEXT,
ADD COLUMN IF NOT EXISTS module_id UUID;

-- Part 4: Enhanced Unified Notification Function
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
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  -- Get record name based on module_type
  IF COALESCE(NEW.module_type, OLD.module_type) = 'deals' THEN
    SELECT deal_name INTO record_name FROM deals WHERE id = COALESCE(NEW.module_id, OLD.module_id)::uuid;
  ELSIF COALESCE(NEW.module_type, OLD.module_type) = 'leads' THEN
    SELECT lead_name INTO record_name FROM leads WHERE id = COALESCE(NEW.module_id, OLD.module_id)::uuid;
  ELSIF COALESCE(NEW.module_type, OLD.module_type) = 'contacts' THEN
    SELECT contact_name INTO record_name FROM contacts WHERE id = COALESCE(NEW.module_id, OLD.module_id)::uuid;
  END IF;

  -- INSERT: Notify assignee if different from creator
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != NEW.created_by THEN
      message_text := 'New task assigned: ' || NEW.title;
      IF record_name IS NOT NULL THEN
        message_text := message_text || ' (' || record_name || ')';
      END IF;
      IF NEW.priority = 'High' THEN
        message_text := '🔴 ' || message_text;
      END IF;
      
      INSERT INTO notifications (user_id, message, notification_type, action_item_id, module_type, module_id)
      VALUES (NEW.assigned_to, message_text, notification_type, NEW.id, NEW.module_type, NEW.module_id);
    END IF;
    
  -- UPDATE: Multiple notification scenarios
  ELSIF TG_OP = 'UPDATE' THEN
    -- Scenario 1: Assignee changed - notify new assignee
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to AND NEW.assigned_to IS NOT NULL THEN
      IF NEW.assigned_to != current_user_id THEN
        message_text := 'Task assigned to you: ' || NEW.title;
        IF record_name IS NOT NULL THEN
          message_text := message_text || ' (' || record_name || ')';
        END IF;
        IF NEW.priority = 'High' THEN
          message_text := '🔴 ' || message_text;
        END IF;
        
        INSERT INTO notifications (user_id, message, notification_type, action_item_id, module_type, module_id)
        VALUES (NEW.assigned_to, message_text, notification_type, NEW.id, NEW.module_type, NEW.module_id);
      END IF;
      
      -- Notify old assignee they were unassigned
      IF OLD.assigned_to IS NOT NULL AND OLD.assigned_to != current_user_id THEN
        INSERT INTO notifications (user_id, message, notification_type, action_item_id, module_type, module_id)
        VALUES (OLD.assigned_to, 'Task reassigned: ' || NEW.title, notification_type, NEW.id, NEW.module_type, NEW.module_id);
      END IF;
    END IF;
    
    -- Scenario 2: Status changed to Completed - notify creator
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'Completed' THEN
      IF NEW.created_by IS NOT NULL AND NEW.created_by != current_user_id THEN
        message_text := '✅ Task completed: ' || NEW.title;
        INSERT INTO notifications (user_id, message, notification_type, action_item_id, module_type, module_id)
        VALUES (NEW.created_by, message_text, notification_type, NEW.id, NEW.module_type, NEW.module_id);
      END IF;
    END IF;
    
    -- Scenario 3: Priority changed to High - notify assignee
    IF OLD.priority IS DISTINCT FROM NEW.priority AND NEW.priority = 'High' THEN
      IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != current_user_id THEN
        message_text := '🔴 Priority escalated to High: ' || NEW.title;
        INSERT INTO notifications (user_id, message, notification_type, action_item_id, module_type, module_id)
        VALUES (NEW.assigned_to, message_text, notification_type, NEW.id, NEW.module_type, NEW.module_id);
      END IF;
    END IF;
    
  -- DELETE: Notify assignee
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.assigned_to IS NOT NULL AND OLD.assigned_to != current_user_id THEN
      message_text := 'Task deleted: ' || OLD.title;
      INSERT INTO notifications (user_id, message, notification_type, action_item_id, module_type, module_id)
      VALUES (OLD.assigned_to, message_text, notification_type, OLD.id, OLD.module_type, OLD.module_id);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Part 5: Recreate trigger to include DELETE
DROP TRIGGER IF EXISTS unified_action_item_notification_trigger ON public.action_items;
CREATE TRIGGER unified_action_item_notification_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.action_items
  FOR EACH ROW EXECUTE FUNCTION create_unified_action_item_notification();