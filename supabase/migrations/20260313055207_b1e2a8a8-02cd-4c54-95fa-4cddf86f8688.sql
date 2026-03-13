
-- Add unique constraints to prevent duplicate accounts/contacts in campaigns
ALTER TABLE campaign_accounts ADD CONSTRAINT campaign_accounts_campaign_account_unique UNIQUE (campaign_id, account_id);
ALTER TABLE campaign_contacts ADD CONSTRAINT campaign_contacts_campaign_contact_unique UNIQUE (campaign_id, contact_id);

-- Drop existing FK constraints and re-add with ON DELETE CASCADE
-- campaign_accounts
ALTER TABLE campaign_accounts DROP CONSTRAINT IF EXISTS campaign_accounts_campaign_id_fkey;
ALTER TABLE campaign_accounts ADD CONSTRAINT campaign_accounts_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
ALTER TABLE campaign_accounts DROP CONSTRAINT IF EXISTS campaign_accounts_account_id_fkey;
ALTER TABLE campaign_accounts ADD CONSTRAINT campaign_accounts_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;

-- campaign_contacts
ALTER TABLE campaign_contacts DROP CONSTRAINT IF EXISTS campaign_contacts_campaign_id_fkey;
ALTER TABLE campaign_contacts ADD CONSTRAINT campaign_contacts_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
ALTER TABLE campaign_contacts DROP CONSTRAINT IF EXISTS campaign_contacts_contact_id_fkey;
ALTER TABLE campaign_contacts ADD CONSTRAINT campaign_contacts_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;

-- campaign_communications
ALTER TABLE campaign_communications DROP CONSTRAINT IF EXISTS campaign_communications_campaign_id_fkey;
ALTER TABLE campaign_communications ADD CONSTRAINT campaign_communications_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
ALTER TABLE campaign_communications DROP CONSTRAINT IF EXISTS campaign_communications_contact_id_fkey;
ALTER TABLE campaign_communications ADD CONSTRAINT campaign_communications_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE campaign_communications DROP CONSTRAINT IF EXISTS campaign_communications_account_id_fkey;
ALTER TABLE campaign_communications ADD CONSTRAINT campaign_communications_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL;

-- campaign_email_templates
ALTER TABLE campaign_email_templates DROP CONSTRAINT IF EXISTS campaign_email_templates_campaign_id_fkey;
ALTER TABLE campaign_email_templates ADD CONSTRAINT campaign_email_templates_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

-- campaign_phone_scripts
ALTER TABLE campaign_phone_scripts DROP CONSTRAINT IF EXISTS campaign_phone_scripts_campaign_id_fkey;
ALTER TABLE campaign_phone_scripts ADD CONSTRAINT campaign_phone_scripts_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;

-- campaign_materials
ALTER TABLE campaign_materials DROP CONSTRAINT IF EXISTS campaign_materials_campaign_id_fkey;
ALTER TABLE campaign_materials ADD CONSTRAINT campaign_materials_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE;
