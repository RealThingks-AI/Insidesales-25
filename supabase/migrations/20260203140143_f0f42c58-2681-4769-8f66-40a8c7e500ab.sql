-- ═══════════════════════════════════════════════════════════════
-- Enhanced Notification System Migration
-- Implements "notify the other party" logic
-- ═══════════════════════════════════════════════════════════════

-- Drop existing trigger first
DROP TRIGGER IF EXISTS unified_action_item_notification_trigger ON public.action_items;

-- ═══════════════════════════════════════════════════════════════
-- Enhanced Action Items Notification Trigger
-- ═══════════════════════════════════════════════════════════════
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
  v_created_by UUID;
  v_assigned_to UUID;
BEGIN
  current_user_id := auth.uid();
  v_created_by := COALESCE(NEW.created_by, OLD.created_by);
  v_assigned_to := COALESCE(NEW.assigned_to, OLD.assigned_to);
  
  -- Get record name based on module_type
  IF COALESCE(NEW.module_type, OLD.module_type) = 'deals' THEN
    SELECT deal_name INTO record_name FROM deals WHERE id = COALESCE(NEW.module_id, OLD.module_id)::uuid;
  ELSIF COALESCE(NEW.module_type, OLD.module_type) = 'leads' THEN
    SELECT lead_name INTO record_name FROM leads WHERE id = COALESCE(NEW.module_id, OLD.module_id)::uuid;
  ELSIF COALESCE(NEW.module_type, OLD.module_type) = 'contacts' THEN
    SELECT contact_name INTO record_name FROM contacts WHERE id = COALESCE(NEW.module_id, OLD.module_id)::uuid;
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- INSERT: New task created
  -- ═══════════════════════════════════════════════════════════════
  IF TG_OP = 'INSERT' THEN
    -- Notify assignee if assigned to someone other than creator
    IF NEW.assigned_to IS NOT NULL 
       AND NEW.assigned_to != NEW.created_by THEN
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
    
  -- ═══════════════════════════════════════════════════════════════
  -- UPDATE: Task modified
  -- ═══════════════════════════════════════════════════════════════
  ELSIF TG_OP = 'UPDATE' THEN
  
    -- ─────────────────────────────────────────────────────────────
    -- Scenario 1: Assignee changed
    -- ─────────────────────────────────────────────────────────────
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
      -- Notify NEW assignee (if not the one making the change)
      IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != current_user_id THEN
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
      
      -- Notify OLD assignee (if not the one making the change)
      IF OLD.assigned_to IS NOT NULL AND OLD.assigned_to != current_user_id THEN
        INSERT INTO notifications (user_id, message, notification_type, action_item_id, module_type, module_id)
        VALUES (OLD.assigned_to, 'Task reassigned from you: ' || NEW.title, notification_type, NEW.id, NEW.module_type, NEW.module_id);
      END IF;
      
      -- Notify CREATOR if a third party changed the assignee
      IF v_created_by IS NOT NULL 
         AND v_created_by != current_user_id 
         AND v_created_by != OLD.assigned_to 
         AND v_created_by != NEW.assigned_to THEN
        INSERT INTO notifications (user_id, message, notification_type, action_item_id, module_type, module_id)
        VALUES (v_created_by, 'Task reassignment: ' || NEW.title, notification_type, NEW.id, NEW.module_type, NEW.module_id);
      END IF;
    END IF;
    
    -- ─────────────────────────────────────────────────────────────
    -- Scenario 2: Status changed to Completed
    -- ─────────────────────────────────────────────────────────────
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'Completed' THEN
      message_text := '✅ Task completed: ' || NEW.title;
      IF record_name IS NOT NULL THEN
        message_text := message_text || ' (' || record_name || ')';
      END IF;
      
      -- Notify CREATOR (if not the one who completed it)
      IF v_created_by IS NOT NULL AND v_created_by != current_user_id THEN
        INSERT INTO notifications (user_id, message, notification_type, action_item_id, module_type, module_id)
        VALUES (v_created_by, message_text, notification_type, NEW.id, NEW.module_type, NEW.module_id);
      END IF;
      
      -- Notify ASSIGNEE (if not the one who completed it AND different from creator)
      IF v_assigned_to IS NOT NULL 
         AND v_assigned_to != current_user_id 
         AND v_assigned_to != v_created_by THEN
        INSERT INTO notifications (user_id, message, notification_type, action_item_id, module_type, module_id)
        VALUES (v_assigned_to, message_text, notification_type, NEW.id, NEW.module_type, NEW.module_id);
      END IF;
    END IF;
    
    -- ─────────────────────────────────────────────────────────────
    -- Scenario 3: Priority changed to High
    -- ─────────────────────────────────────────────────────────────
    IF OLD.priority IS DISTINCT FROM NEW.priority AND NEW.priority = 'High' THEN
      message_text := '🔴 Priority escalated to High: ' || NEW.title;
      IF record_name IS NOT NULL THEN
        message_text := message_text || ' (' || record_name || ')';
      END IF;
      
      -- Notify CREATOR (if not the one who changed priority)
      IF v_created_by IS NOT NULL AND v_created_by != current_user_id THEN
        INSERT INTO notifications (user_id, message, notification_type, action_item_id, module_type, module_id)
        VALUES (v_created_by, message_text, notification_type, NEW.id, NEW.module_type, NEW.module_id);
      END IF;
      
      -- Notify ASSIGNEE (if not the one who changed priority AND different from creator)
      IF v_assigned_to IS NOT NULL 
         AND v_assigned_to != current_user_id 
         AND v_assigned_to != v_created_by THEN
        INSERT INTO notifications (user_id, message, notification_type, action_item_id, module_type, module_id)
        VALUES (v_assigned_to, message_text, notification_type, NEW.id, NEW.module_type, NEW.module_id);
      END IF;
    END IF;
    
    -- ─────────────────────────────────────────────────────────────
    -- Scenario 4: Due date changed
    -- ─────────────────────────────────────────────────────────────
    IF OLD.due_date IS DISTINCT FROM NEW.due_date AND NEW.due_date IS NOT NULL THEN
      message_text := 'Due date updated: ' || NEW.title || ' → ' || to_char(NEW.due_date::date, 'DD-Mon-YYYY');
      IF record_name IS NOT NULL THEN
        message_text := message_text || ' (' || record_name || ')';
      END IF;
      
      -- Notify ASSIGNEE (if not the one who changed it AND different from creator)
      IF v_assigned_to IS NOT NULL 
         AND v_assigned_to != current_user_id 
         AND v_assigned_to != v_created_by THEN
        INSERT INTO notifications (user_id, message, notification_type, action_item_id, module_type, module_id)
        VALUES (v_assigned_to, message_text, notification_type, NEW.id, NEW.module_type, NEW.module_id);
      END IF;
    END IF;
    
  -- ═══════════════════════════════════════════════════════════════
  -- DELETE: Task deleted
  -- ═══════════════════════════════════════════════════════════════
  ELSIF TG_OP = 'DELETE' THEN
    message_text := '🗑️ Task deleted: ' || OLD.title;
    IF record_name IS NOT NULL THEN
      message_text := message_text || ' (' || record_name || ')';
    END IF;
    
    -- Notify CREATOR (if not the one who deleted it)
    IF v_created_by IS NOT NULL AND v_created_by != current_user_id THEN
      INSERT INTO notifications (user_id, message, notification_type, action_item_id, module_type, module_id)
      VALUES (v_created_by, message_text, notification_type, OLD.id, OLD.module_type, OLD.module_id);
    END IF;
    
    -- Notify ASSIGNEE (if not the one who deleted it AND different from creator)
    IF v_assigned_to IS NOT NULL 
       AND v_assigned_to != current_user_id 
       AND v_assigned_to != v_created_by THEN
      INSERT INTO notifications (user_id, message, notification_type, action_item_id, module_type, module_id)
      VALUES (v_assigned_to, message_text, notification_type, OLD.id, OLD.module_type, OLD.module_id);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Recreate trigger
CREATE TRIGGER unified_action_item_notification_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.action_items
  FOR EACH ROW EXECUTE FUNCTION create_unified_action_item_notification();

-- ═══════════════════════════════════════════════════════════════
-- Deal Notification Trigger (stage changes and deletes)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.create_deal_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  message_text TEXT;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF TG_OP = 'UPDATE' THEN
    -- Stage changed - notify owner (if not the one who changed it)
    IF OLD.stage IS DISTINCT FROM NEW.stage THEN
      IF NEW.created_by IS NOT NULL AND NEW.created_by != current_user_id THEN
        message_text := '📊 Deal "' || COALESCE(NEW.project_name, NEW.deal_name) || '" stage changed: ' || OLD.stage || ' → ' || NEW.stage;
        
        INSERT INTO notifications (user_id, message, notification_type, module_type, module_id)
        VALUES (NEW.created_by, message_text, 'deal_update', 'deals', NEW.id);
      END IF;
    END IF;
    
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.created_by IS NOT NULL AND OLD.created_by != current_user_id THEN
      message_text := '🗑️ Deal "' || COALESCE(OLD.project_name, OLD.deal_name) || '" was deleted';
      
      INSERT INTO notifications (user_id, message, notification_type, module_type, module_id)
      VALUES (OLD.created_by, message_text, 'deal_update', 'deals', OLD.id);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Create deal notification trigger
DROP TRIGGER IF EXISTS deal_notification_trigger ON public.deals;
CREATE TRIGGER deal_notification_trigger
  AFTER UPDATE OR DELETE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION create_deal_notification();

-- ═══════════════════════════════════════════════════════════════
-- Lead Notification Trigger (status changes and deletes)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.create_lead_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  message_text TEXT;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF TG_OP = 'UPDATE' THEN
    -- Status changed - notify owner (if not the one who changed it)
    IF OLD.lead_status IS DISTINCT FROM NEW.lead_status THEN
      IF NEW.created_by IS NOT NULL AND NEW.created_by != current_user_id THEN
        message_text := '🔄 Lead "' || NEW.lead_name || '" status changed: ' || COALESCE(OLD.lead_status, 'None') || ' → ' || COALESCE(NEW.lead_status, 'None');
        
        INSERT INTO notifications (user_id, message, notification_type, module_type, module_id)
        VALUES (NEW.created_by, message_text, 'lead_update', 'leads', NEW.id);
      END IF;
    END IF;
    
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.created_by IS NOT NULL AND OLD.created_by != current_user_id THEN
      message_text := '🗑️ Lead "' || OLD.lead_name || '" was deleted';
      
      INSERT INTO notifications (user_id, message, notification_type, module_type, module_id)
      VALUES (OLD.created_by, message_text, 'lead_update', 'leads', OLD.id);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Create lead notification trigger
DROP TRIGGER IF EXISTS lead_notification_trigger ON public.leads;
CREATE TRIGGER lead_notification_trigger
  AFTER UPDATE OR DELETE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION create_lead_notification();

-- ═══════════════════════════════════════════════════════════════
-- Cleanup orphaned notifications
-- ═══════════════════════════════════════════════════════════════

-- Delete notifications where action_item_id references deleted items
DELETE FROM notifications 
WHERE action_item_id IS NOT NULL 
  AND action_item_id NOT IN (SELECT id FROM action_items);

-- Delete legacy format notifications without proper linking
DELETE FROM notifications 
WHERE action_item_id IS NULL
  AND module_id IS NULL
  AND (message LIKE 'New action item added for%'
       OR message LIKE 'Action item closed for%'
       OR message LIKE 'Action item updated for%'
       OR message LIKE 'Action item deleted for%');

-- Backfill module_type/module_id for existing notifications from action_items
UPDATE notifications n
SET 
  module_type = ai.module_type,
  module_id = ai.module_id
FROM action_items ai
WHERE n.action_item_id = ai.id
  AND n.module_type IS NULL;