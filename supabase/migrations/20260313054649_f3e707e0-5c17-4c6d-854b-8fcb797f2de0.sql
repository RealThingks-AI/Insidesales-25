
-- Drop existing foreign keys first, then recreate with ON DELETE CASCADE
DO $$
BEGIN
  -- campaign_accounts
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'campaign_accounts_campaign_id_fkey') THEN
    ALTER TABLE public.campaign_accounts DROP CONSTRAINT campaign_accounts_campaign_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'campaign_accounts_account_id_fkey') THEN
    ALTER TABLE public.campaign_accounts DROP CONSTRAINT campaign_accounts_account_id_fkey;
  END IF;

  -- campaign_contacts
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'campaign_contacts_campaign_id_fkey') THEN
    ALTER TABLE public.campaign_contacts DROP CONSTRAINT campaign_contacts_campaign_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'campaign_contacts_contact_id_fkey') THEN
    ALTER TABLE public.campaign_contacts DROP CONSTRAINT campaign_contacts_contact_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'campaign_contacts_account_id_fkey') THEN
    ALTER TABLE public.campaign_contacts DROP CONSTRAINT campaign_contacts_account_id_fkey;
  END IF;

  -- campaign_communications
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'campaign_communications_campaign_id_fkey') THEN
    ALTER TABLE public.campaign_communications DROP CONSTRAINT campaign_communications_campaign_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'campaign_communications_contact_id_fkey') THEN
    ALTER TABLE public.campaign_communications DROP CONSTRAINT campaign_communications_contact_id_fkey;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'campaign_communications_account_id_fkey') THEN
    ALTER TABLE public.campaign_communications DROP CONSTRAINT campaign_communications_account_id_fkey;
  END IF;

  -- campaign_email_templates
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'campaign_email_templates_campaign_id_fkey') THEN
    ALTER TABLE public.campaign_email_templates DROP CONSTRAINT campaign_email_templates_campaign_id_fkey;
  END IF;

  -- campaign_phone_scripts
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'campaign_phone_scripts_campaign_id_fkey') THEN
    ALTER TABLE public.campaign_phone_scripts DROP CONSTRAINT campaign_phone_scripts_campaign_id_fkey;
  END IF;

  -- campaign_materials
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'campaign_materials_campaign_id_fkey') THEN
    ALTER TABLE public.campaign_materials DROP CONSTRAINT campaign_materials_campaign_id_fkey;
  END IF;
END $$;

-- Recreate all with ON DELETE CASCADE / SET NULL
ALTER TABLE public.campaign_accounts
  ADD CONSTRAINT campaign_accounts_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE,
  ADD CONSTRAINT campaign_accounts_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.campaign_contacts
  ADD CONSTRAINT campaign_contacts_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE,
  ADD CONSTRAINT campaign_contacts_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE,
  ADD CONSTRAINT campaign_contacts_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;

ALTER TABLE public.campaign_communications
  ADD CONSTRAINT campaign_communications_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE,
  ADD CONSTRAINT campaign_communications_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD CONSTRAINT campaign_communications_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;

ALTER TABLE public.campaign_email_templates
  ADD CONSTRAINT campaign_email_templates_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;

ALTER TABLE public.campaign_phone_scripts
  ADD CONSTRAINT campaign_phone_scripts_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;

ALTER TABLE public.campaign_materials
  ADD CONSTRAINT campaign_materials_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;
