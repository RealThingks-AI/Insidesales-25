-- Remove duplicate campaign_contacts (keep the earliest created)
DELETE FROM campaign_contacts
WHERE id NOT IN (
  SELECT DISTINCT ON (campaign_id, contact_id) id
  FROM campaign_contacts
  ORDER BY campaign_id, contact_id, created_at ASC
);

-- Remove duplicate campaign_accounts (keep the earliest created)
DELETE FROM campaign_accounts
WHERE id NOT IN (
  SELECT DISTINCT ON (campaign_id, account_id) id
  FROM campaign_accounts
  ORDER BY campaign_id, account_id, created_at ASC
);

-- Add unique constraints
ALTER TABLE campaign_contacts
  ADD CONSTRAINT campaign_contacts_campaign_id_contact_id_unique
  UNIQUE (campaign_id, contact_id);

ALTER TABLE campaign_accounts
  ADD CONSTRAINT campaign_accounts_campaign_id_account_id_unique
  UNIQUE (campaign_id, account_id);