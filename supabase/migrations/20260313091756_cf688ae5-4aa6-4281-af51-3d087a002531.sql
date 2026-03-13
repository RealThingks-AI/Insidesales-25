-- 1. Add new enum values
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'sales_head';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'field_sales';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'inside_sales';

-- 2. Add new columns to page_permissions
ALTER TABLE page_permissions
  ADD COLUMN IF NOT EXISTS super_admin_access boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS sales_head_access boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS field_sales_access boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS inside_sales_access boolean DEFAULT true;

-- 3. Set Inside Sales restrictions
UPDATE page_permissions SET inside_sales_access = false 
WHERE route IN ('/deals', '/action-items');

-- 4. Add missing Campaigns row
INSERT INTO page_permissions (page_name, route, description, admin_access, manager_access, user_access, super_admin_access, sales_head_access, field_sales_access, inside_sales_access)
VALUES ('Campaigns', '/campaigns', 'Campaign management', true, true, true, true, true, true, true)
ON CONFLICT DO NOTHING;

-- 5. Update is_user_admin to include super_admin
CREATE OR REPLACE FUNCTION public.is_user_admin(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT get_user_role(user_id) IN ('admin', 'super_admin');
$$;

-- 6. Drop disabled triggers (cleanup)
DROP TRIGGER IF EXISTS deal_action_item_notification_trigger ON deal_action_items;
DROP TRIGGER IF EXISTS action_item_notification_trigger ON lead_action_items;

-- 7. Fix validate_deal_dates (allow future dates)
CREATE OR REPLACE FUNCTION public.validate_deal_dates()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.implementation_start_date IS NOT NULL AND (NEW.handoff_status IS NULL OR NEW.handoff_status = '') THEN
    RAISE EXCEPTION 'Handoff status is required when implementation start date is set';
  END IF;
  RETURN NEW;
END;
$$;

-- 8. Add INSERT policy for page_permissions (admins only)
CREATE POLICY "Admins can insert page permissions"
  ON page_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (is_current_user_admin());