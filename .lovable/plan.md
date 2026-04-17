

# Fix Plan: Account Table & Modal Improvements

## Changes

### 1. Add Description Column to Account Table (AccountTable.tsx + AccountTableBody.tsx)

**AccountTable.tsx (line 42):** Insert `description` column at order 1 (after account_name), shift all other orders up by 1. Also add `'description'` to `searchFields`.

**AccountTableBody.tsx:**
- Add `description` field formatting in `formatCellValue` — render with `line-clamp-2` and `truncate` to prevent overflow
- In table cell classes (line 277-285), add specific width rule for `description`: `min-w-[250px] max-w-[350px]`
- Apply `table-fixed` layout with explicit column widths to prevent content overlap across ALL columns
- For `linked_contacts` column header, center-align the label text to match the centered badge data

### 2. Fix Column Overflow / Alignment Issues (AccountTableBody.tsx)

- Add `overflow-hidden text-ellipsis` to all table cells to prevent text from bleeding into adjacent columns
- Set `table-layout: fixed` on the Table element so column widths are enforced
- Ensure `linked_contacts` header text is centered (currently uses left-aligned `<span>` but data is centered)
- Set proper `min-width` values: account_name 200px, description 250px, linked 80px centered, others 100px

### 3. Rearrange Account Modal Fields (AccountModal.tsx)

Restructure the form layout from the current 2-column grid to specific rows:

- **Row 1:** Account Name + Industry (2-col grid)
- **Row 2:** Description (full width textarea)
- **Row 3:** Website + Phone (2-col grid)
- **Row 4:** Region + Country (2-col grid) — country selection auto-updates region via existing `countryToRegion` mapping. The existing `countryRegionMapping.ts` already has 200+ countries and 7 regions with proper sync.
- **Row 5:** Company Type + Currency + Status (3-col grid)

### 4. Country/Region Filtering in Modal

Add filtered country list based on selected region. When user selects a region first, only show countries from that region. When country is selected, auto-fill region (already working).

## Files Modified

| File | Change |
|------|--------|
| `src/components/AccountTable.tsx` | Add description column to defaultColumns, add to searchFields |
| `src/components/account-table/AccountTableBody.tsx` | Add description cell formatting, fix overflow with table-fixed layout, center Linked header |
| `src/components/AccountModal.tsx` | Rearrange fields into 5 specific rows, add region-based country filtering |

