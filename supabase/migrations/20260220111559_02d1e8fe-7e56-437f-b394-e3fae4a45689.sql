
-- Create deal_stakeholders junction table
CREATE TABLE public.deal_stakeholders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  role text NOT NULL,
  note text,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  UNIQUE(deal_id, contact_id, role)
);

-- Enable RLS
ALTER TABLE public.deal_stakeholders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view deal stakeholders"
  ON public.deal_stakeholders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert deal stakeholders"
  ON public.deal_stakeholders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator or admin can update deal stakeholders"
  ON public.deal_stakeholders FOR UPDATE
  TO authenticated
  USING (is_user_admin() OR created_by = auth.uid());

CREATE POLICY "Creator or admin can delete deal stakeholders"
  ON public.deal_stakeholders FOR DELETE
  TO authenticated
  USING (is_user_admin() OR created_by = auth.uid());

-- Migrate existing data from deals table
INSERT INTO public.deal_stakeholders (deal_id, contact_id, role, created_by)
SELECT id, budget_owner_contact_id, 'budget_owner', created_by
FROM public.deals WHERE budget_owner_contact_id IS NOT NULL;

INSERT INTO public.deal_stakeholders (deal_id, contact_id, role, created_by)
SELECT id, champion_contact_id, 'champion', created_by
FROM public.deals WHERE champion_contact_id IS NOT NULL;

INSERT INTO public.deal_stakeholders (deal_id, contact_id, role, created_by)
SELECT id, influencer_contact_id, 'influencer', created_by
FROM public.deals WHERE influencer_contact_id IS NOT NULL;

INSERT INTO public.deal_stakeholders (deal_id, contact_id, role, created_by)
SELECT id, objector_contact_id, 'objector', created_by
FROM public.deals WHERE objector_contact_id IS NOT NULL;
