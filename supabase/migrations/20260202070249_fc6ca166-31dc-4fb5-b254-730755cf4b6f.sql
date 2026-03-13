-- Migrate deal_action_items to action_items
INSERT INTO action_items (
  module_type, module_id, title, description, assigned_to,
  due_date, priority, status, created_by, created_at, updated_at
)
SELECT
  'deals' as module_type,
  deal_id as module_id,
  next_action as title,
  NULL as description,
  assigned_to,
  due_date,
  'Medium' as priority,
  CASE status
    WHEN 'Ongoing' THEN 'In Progress'
    WHEN 'Closed' THEN 'Completed'
    ELSE status
  END as status,
  created_by,
  created_at,
  updated_at
FROM deal_action_items;

-- Migrate lead_action_items to action_items
INSERT INTO action_items (
  module_type, module_id, title, description, assigned_to,
  due_date, priority, status, created_by, created_at, updated_at
)
SELECT
  'leads' as module_type,
  lead_id as module_id,
  next_action as title,
  NULL as description,
  assigned_to,
  due_date,
  'Medium' as priority,
  CASE status
    WHEN 'Ongoing' THEN 'In Progress'
    WHEN 'Closed' THEN 'Completed'
    ELSE status
  END as status,
  created_by,
  created_at,
  updated_at
FROM lead_action_items;