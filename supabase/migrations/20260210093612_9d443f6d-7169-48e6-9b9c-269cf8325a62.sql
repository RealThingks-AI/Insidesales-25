
-- Step 1: Add account_id columns
ALTER TABLE leads ADD COLUMN account_id UUID REFERENCES accounts(id);
ALTER TABLE deals ADD COLUMN account_id UUID REFERENCES accounts(id);

-- Step 2: Create missing accounts and backfill
DO $$
DECLARE
  v_name TEXT;
  v_account_id UUID;
  v_names TEXT[];
BEGIN
  -- === BACKFILL LEADS with known account mappings ===
  UPDATE leads SET account_id = '6ba73da7-e22d-4f8d-b544-990de4a92e74' WHERE LOWER(TRIM(company_name)) = 'bmw' AND account_id IS NULL;
  UPDATE leads SET account_id = '01114d16-51c2-43c0-91a2-178540cd8d10' WHERE LOWER(TRIM(company_name)) IN ('cariad', 'cariad us') AND account_id IS NULL;
  UPDATE leads SET account_id = '2b3ecebd-ce7a-484f-9e5c-2b0f119be090' WHERE LOWER(REPLACE(TRIM(company_name), '  ', ' ')) IN ('refu drive', 'refu  drive') AND account_id IS NULL;
  UPDATE leads SET account_id = 'd0ef115a-d35e-4ee7-973d-427296d02b3f' WHERE LOWER(TRIM(company_name)) = 'continental' AND account_id IS NULL;
  UPDATE leads SET account_id = '1b8935e7-042c-46a8-a5a5-6c8ed472f25a' WHERE LOWER(TRIM(company_name)) = 'harley davidson' AND account_id IS NULL;
  UPDATE leads SET account_id = '42880f13-6bcf-4338-b1be-9c13c4d0bae8' WHERE LOWER(TRIM(company_name)) = 'porsche' AND account_id IS NULL;
  UPDATE leads SET account_id = '53850f58-f5e4-425c-b344-202a222c6ec1' WHERE LOWER(TRIM(company_name)) = 'mercedes benz india' AND account_id IS NULL;
  UPDATE leads SET account_id = '2957220c-9bc5-41e0-b731-e51e900ee18e' WHERE LOWER(TRIM(company_name)) = 'stellantis' AND account_id IS NULL;
  UPDATE leads SET account_id = '56bbd51f-e4d8-4a3a-bc34-655b27968f37' WHERE LOWER(TRIM(company_name)) = 'marelli' AND account_id IS NULL;
  UPDATE leads SET account_id = '1ff0726e-2a4a-442f-ba2b-b918d802f000' WHERE LOWER(TRIM(company_name)) = 'volvo cars' AND account_id IS NULL;

  -- === BACKFILL DEALS with known account mappings ===
  UPDATE deals SET account_id = '6ba73da7-e22d-4f8d-b544-990de4a92e74' WHERE LOWER(TRIM(customer_name)) = 'bmw' AND account_id IS NULL;
  UPDATE deals SET account_id = '01114d16-51c2-43c0-91a2-178540cd8d10' WHERE LOWER(TRIM(customer_name)) IN ('cariad', 'cariad us') AND account_id IS NULL;
  UPDATE deals SET account_id = '2b3ecebd-ce7a-484f-9e5c-2b0f119be090' WHERE LOWER(REPLACE(REPLACE(TRIM(customer_name), '  ', ' '), '  ', ' ')) ILIKE 'refu drive' OR LOWER(REPLACE(REPLACE(TRIM(customer_name), '  ', ' '), '  ', ' ')) ILIKE 'refu  drive' AND account_id IS NULL;
  UPDATE deals SET account_id = 'd0ef115a-d35e-4ee7-973d-427296d02b3f' WHERE LOWER(TRIM(customer_name)) = 'continental' AND account_id IS NULL;
  UPDATE deals SET account_id = '1b8935e7-042c-46a8-a5a5-6c8ed472f25a' WHERE LOWER(TRIM(customer_name)) = 'harley davidson' AND account_id IS NULL;
  UPDATE deals SET account_id = '42880f13-6bcf-4338-b1be-9c13c4d0bae8' WHERE LOWER(TRIM(customer_name)) = 'porsche' AND account_id IS NULL;
  UPDATE deals SET account_id = '53850f58-f5e4-425c-b344-202a222c6ec1' WHERE LOWER(TRIM(customer_name)) = 'mercedes benz india' AND account_id IS NULL;
  UPDATE deals SET account_id = '2957220c-9bc5-41e0-b731-e51e900ee18e' WHERE LOWER(TRIM(customer_name)) = 'stellantis' AND account_id IS NULL;
  UPDATE deals SET account_id = '56bbd51f-e4d8-4a3a-bc34-655b27968f37' WHERE LOWER(TRIM(customer_name)) = 'marelli' AND account_id IS NULL;
  UPDATE deals SET account_id = '1ff0726e-2a4a-442f-ba2b-b918d802f000' WHERE LOWER(TRIM(customer_name)) = 'volvo cars' AND account_id IS NULL;

  -- === CREATE NEW ACCOUNTS for unmatched names from DEALS ===
  v_names := ARRAY['Accenture', 'Aumovio', 'BMW - Accenture', 'BMW Tech Works', 'BMW/Acsia', 'CARIAD US', 'ClearMotion', 'Coretura', 'Eberspächer', 'Hanon', 'Kiekert', 'Lamborgini', 'LG - tQCS', 'LG Virtualization', 'LSAT', 'Siemens / Volvo Trucks', 'TATA Elxsi', 'Thyssen Krupp', 'TKE', 'Volvo AB', 'VW'];
  
  FOREACH v_name IN ARRAY v_names LOOP
    -- Check if account already exists (case-insensitive)
    SELECT id INTO v_account_id FROM accounts WHERE LOWER(account_name) = LOWER(v_name) LIMIT 1;
    
    IF v_account_id IS NULL THEN
      INSERT INTO accounts (account_name) VALUES (v_name) RETURNING id INTO v_account_id;
    END IF;
    
    -- Link deals with this customer_name
    UPDATE deals SET account_id = v_account_id WHERE TRIM(customer_name) = v_name AND account_id IS NULL;
    -- Link leads with this company_name
    UPDATE leads SET account_id = v_account_id WHERE TRIM(company_name) = v_name AND account_id IS NULL;
  END LOOP;

  -- === CREATE NEW ACCOUNTS for unmatched names from LEADS (that weren't in deals list) ===
  v_names := ARRAY['Antolin', 'Aptiv', 'BHTC', 'BMW Tech Center India', 'Daichi', 'Kostal', 'Preh', 'Scania / MAN', 'Test', 'Vestel'];
  
  FOREACH v_name IN ARRAY v_names LOOP
    SELECT id INTO v_account_id FROM accounts WHERE LOWER(account_name) = LOWER(v_name) LIMIT 1;
    
    IF v_account_id IS NULL THEN
      INSERT INTO accounts (account_name) VALUES (v_name) RETURNING id INTO v_account_id;
    END IF;
    
    UPDATE leads SET account_id = v_account_id WHERE TRIM(company_name) = v_name AND account_id IS NULL;
  END LOOP;

  -- === CATCH-ALL: For any remaining unmatched leads/deals, create accounts ===
  -- Leads
  FOR v_name IN SELECT DISTINCT TRIM(company_name) FROM leads WHERE account_id IS NULL AND company_name IS NOT NULL AND TRIM(company_name) != '' LOOP
    SELECT id INTO v_account_id FROM accounts WHERE LOWER(account_name) = LOWER(v_name) LIMIT 1;
    IF v_account_id IS NULL THEN
      INSERT INTO accounts (account_name) VALUES (v_name) RETURNING id INTO v_account_id;
    END IF;
    UPDATE leads SET account_id = v_account_id WHERE TRIM(company_name) = v_name AND account_id IS NULL;
  END LOOP;
  
  -- Deals
  FOR v_name IN SELECT DISTINCT TRIM(customer_name) FROM deals WHERE account_id IS NULL AND customer_name IS NOT NULL AND TRIM(customer_name) != '' LOOP
    SELECT id INTO v_account_id FROM accounts WHERE LOWER(account_name) = LOWER(v_name) LIMIT 1;
    IF v_account_id IS NULL THEN
      INSERT INTO accounts (account_name) VALUES (v_name) RETURNING id INTO v_account_id;
    END IF;
    UPDATE deals SET account_id = v_account_id WHERE TRIM(customer_name) = v_name AND account_id IS NULL;
  END LOOP;

END $$;
