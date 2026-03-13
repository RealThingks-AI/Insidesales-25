
-- Add stakeholder contact columns to deals table
ALTER TABLE public.deals ADD COLUMN budget_owner_contact_id uuid;
ALTER TABLE public.deals ADD COLUMN champion_contact_id uuid;
ALTER TABLE public.deals ADD COLUMN objector_contact_id uuid;
ALTER TABLE public.deals ADD COLUMN influencer_contact_id uuid;
