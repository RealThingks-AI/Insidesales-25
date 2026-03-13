-- Drop duplicate unique constraints on campaign_accounts (keep campaign_accounts_campaign_id_account_id_key)
ALTER TABLE public.campaign_accounts DROP CONSTRAINT IF EXISTS campaign_accounts_campaign_id_account_id_unique;
ALTER TABLE public.campaign_accounts DROP CONSTRAINT IF EXISTS campaign_accounts_campaign_account_unique;

-- Drop duplicate unique constraints on campaign_contacts (keep campaign_contacts_campaign_id_contact_id_key)
ALTER TABLE public.campaign_contacts DROP CONSTRAINT IF EXISTS campaign_contacts_campaign_id_contact_id_unique;
ALTER TABLE public.campaign_contacts DROP CONSTRAINT IF EXISTS campaign_contacts_campaign_contact_unique;