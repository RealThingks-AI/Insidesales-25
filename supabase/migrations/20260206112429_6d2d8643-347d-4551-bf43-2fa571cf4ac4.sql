-- Step 1: Normalize country names to canonical form

-- USA variants
UPDATE accounts SET country = 'USA' 
WHERE lower(country) IN ('united states', 'united states of america', 'us', 'u.s.', 'u.s.a.', 'america');

-- UK variants
UPDATE accounts SET country = 'UK' 
WHERE lower(country) IN ('united kingdom', 'great britain', 'gb', 'england', 'britain');

-- South Korea variants
UPDATE accounts SET country = 'South Korea' 
WHERE lower(country) IN ('korea', 'republic of korea', 's. korea');

-- UAE variants
UPDATE accounts SET country = 'UAE' 
WHERE lower(country) IN ('united arab emirates', 'u.a.e.');

-- Czech variants
UPDATE accounts SET country = 'Czech Republic' 
WHERE lower(country) IN ('czech', 'czechia');

-- Netherlands variants
UPDATE accounts SET country = 'Netherlands' 
WHERE lower(country) IN ('holland', 'the netherlands');

-- Step 2: Populate region based on country for accounts with NULL/empty region

-- ASIA region
UPDATE accounts SET region = 'ASIA' 
WHERE country IN ('China', 'India', 'Israel', 'Japan', 'South Korea', 'Singapore', 'UAE', 'Vietnam') 
AND (region IS NULL OR region = '');

-- EU region
UPDATE accounts SET region = 'EU' 
WHERE country IN ('Austria', 'Belgium', 'Czech Republic', 'Denmark', 'Finland', 'France', 
                  'Germany', 'Ireland', 'Italy', 'Luxembourg', 'Netherlands', 'Poland', 
                  'Portugal', 'Slovakia', 'Spain', 'Sweden', 'Switzerland', 'Turkey', 'UK') 
AND (region IS NULL OR region = '');

-- US/Americas region
UPDATE accounts SET region = 'US' 
WHERE country IN ('USA', 'Canada', 'Mexico', 'Argentina', 'Brazil') 
AND (region IS NULL OR region = '');

-- Other region (fallback for any country not in the above lists)
UPDATE accounts SET region = 'Other' 
WHERE country IS NOT NULL AND country != '' 
AND (region IS NULL OR region = '');

-- Step 3: Deduplicate accounts - keep the most recently modified record for each account_name
DELETE FROM accounts
WHERE id NOT IN (
  SELECT DISTINCT ON (lower(account_name)) id
  FROM accounts
  ORDER BY lower(account_name), 
           modified_time DESC NULLS LAST, 
           created_time DESC NULLS LAST, 
           id
);