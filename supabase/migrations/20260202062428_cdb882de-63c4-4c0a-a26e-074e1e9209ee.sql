-- Create unified action_items table
CREATE TABLE public.action_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_type TEXT NOT NULL CHECK (module_type IN ('deals', 'leads', 'contacts')),
  module_id UUID NULL,
  title TEXT NOT NULL,
  description TEXT NULL,
  assigned_to UUID NULL,
  due_date DATE NULL,
  due_time TIME NULL,
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Completed', 'Cancelled')),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view all action items"
ON public.action_items
FOR SELECT
USING (true);

CREATE POLICY "Users can insert action items"
ON public.action_items
FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own action items or admins can update all"
ON public.action_items
FOR UPDATE
USING (is_user_admin() OR created_by = auth.uid() OR assigned_to = auth.uid());

CREATE POLICY "Users can delete their own action items or admins can delete all"
ON public.action_items
FOR DELETE
USING (is_user_admin() OR created_by = auth.uid());

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_action_items_updated_at
BEFORE UPDATE ON public.action_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for common queries
CREATE INDEX idx_action_items_module ON public.action_items(module_type, module_id);
CREATE INDEX idx_action_items_assigned_to ON public.action_items(assigned_to);
CREATE INDEX idx_action_items_status ON public.action_items(status);
CREATE INDEX idx_action_items_due_date ON public.action_items(due_date);
CREATE INDEX idx_action_items_created_by ON public.action_items(created_by);