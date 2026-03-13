/**
 * Shared country-region mapping utility.
 * Used by AccountModal and CSV import processors.
 */

// Comprehensive country list covering all countries found in the database
export const countries = [
  // ASIA
  "China", "India", "Israel", "Japan", "South Korea", "Singapore", "UAE", "Vietnam",
  // EU
  "Austria", "Belgium", "Czech Republic", "Denmark", "Finland", "France", "Germany",
  "Ireland", "Italy", "Luxembourg", "Netherlands", "Poland", "Portugal", "Slovakia",
  "Spain", "Sweden", "Switzerland", "Turkey", "UK",
  // US / Americas
  "Argentina", "Brazil", "Canada", "Mexico", "USA",
  // Other
  "Australia", "Nigeria", "South Africa",
  "Other"
];

// Regions available for selection
export const regions = ["EU", "US", "ASIA", "Other"];

// Map every country to its region
export const countryToRegion: Record<string, string> = {
  // ASIA
  "China": "ASIA",
  "India": "ASIA",
  "Israel": "ASIA",
  "Japan": "ASIA",
  "South Korea": "ASIA",
  "Singapore": "ASIA",
  "UAE": "ASIA",
  "Vietnam": "ASIA",
  // EU
  "Austria": "EU",
  "Belgium": "EU",
  "Czech Republic": "EU",
  "Denmark": "EU",
  "Finland": "EU",
  "France": "EU",
  "Germany": "EU",
  "Ireland": "EU",
  "Italy": "EU",
  "Luxembourg": "EU",
  "Netherlands": "EU",
  "Poland": "EU",
  "Portugal": "EU",
  "Slovakia": "EU",
  "Spain": "EU",
  "Sweden": "EU",
  "Switzerland": "EU",
  "Turkey": "EU",
  "UK": "EU",
  // US / Americas
  "Argentina": "US",
  "Brazil": "US",
  "Canada": "US",
  "Mexico": "US",
  "USA": "US",
  // Other
  "Australia": "Other",
  "Nigeria": "Other",
  "South Africa": "Other",
  "Other": "Other",
};

/**
 * Mapping of common country name variants to the canonical name used in the system.
 */
const countryAliases: Record<string, string> = {
  // USA variants
  "united states": "USA",
  "united states of america": "USA",
  "us": "USA",
  "u.s.": "USA",
  "u.s.a.": "USA",
  "america": "USA",
  // UK variants
  "united kingdom": "UK",
  "great britain": "UK",
  "gb": "UK",
  "england": "UK",
  "britain": "UK",
  // Korea variants
  "korea": "South Korea",
  "republic of korea": "South Korea",
  "s. korea": "South Korea",
  "south korea": "South Korea",
  // UAE variants
  "united arab emirates": "UAE",
  "u.a.e.": "UAE",
  // Czech variants
  "czech": "Czech Republic",
  "czechia": "Czech Republic",
  // Netherlands variants
  "holland": "Netherlands",
  "the netherlands": "Netherlands",
  // Switzerland variants
  "swiss": "Switzerland",
};

/**
 * Normalize a country name to its canonical form.
 * Handles common variants like "United States" -> "USA", "United Kingdom" -> "UK", etc.
 */
export function normalizeCountryName(country: string | null | undefined): string | null {
  if (!country) return null;
  
  const trimmed = country.trim();
  if (!trimmed) return null;

  // Check if it's already a known canonical name (case-insensitive)
  const exactMatch = countries.find(c => c.toLowerCase() === trimmed.toLowerCase());
  if (exactMatch) return exactMatch;

  // Check aliases
  const alias = countryAliases[trimmed.toLowerCase()];
  if (alias) return alias;

  // Return as-is if no match found (preserves unknown countries)
  return trimmed;
}

/**
 * Get the region for a given country name.
 * Normalizes the country name first, then looks up the region.
 */
export function getRegionForCountry(country: string | null | undefined): string | null {
  const normalized = normalizeCountryName(country);
  if (!normalized) return null;
  return countryToRegion[normalized] || "Other";
}
