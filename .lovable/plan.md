

# CRM Full System Deep QA Report

## Verified Module Map

| Module | Route | Status |
|--------|-------|--------|
| Dashboard | `/` | Implemented - has UserDashboard + Revenue view toggle |
| Accounts | `/accounts` | Implemented |
| Contacts | `/contacts` | Implemented |
| Deals | `/deals` | Implemented - Kanban + List views |
| Campaigns | `/campaigns` | Implemented |
| Action Items | `/action-items` | Implemented |
| Notifications | `/notifications` | Implemented |
| Settings | `/settings` | 4 tabs: My Account, Administration, Email Center, Campaigns |
| Auth | `/auth` | Implemented |

---

## CRITICAL Issues

**C1. Auth handler causes full page reloads on login/logout**
- `useAuth.tsx` lines 101-109: `window.location.replace('/auth')` and `window.location.replace('/')` on SIGNED_OUT/SIGNED_IN events cause full browser reloads, destroying React state and query cache. Meanwhile `ProtectedRoute`/`AuthRoute` already handle redirects via `<Navigate>`, creating double-redirect conflicts.
- **Fix**: Remove `window.location.replace` calls from auth state change handler; let React Router handle navigation.

**C2. DealsPage fetches ALL deals with no pagination**
- `fetchAllRecords()` loads every deal from DB. With 500+ deals the kanban will be extremely slow.
- **Fix**: Add server-side pagination or at minimum a reasonable limit, especially for list view.

**C3. No cascade delete for cross-module relationships**
- Deleting an Account leaves orphan `deals.account_id`, `campaign_accounts.account_id` references. Deleting a Campaign leaves orphan `campaign_contacts`, `campaign_accounts`, `campaign_communications`, `campaign_email_templates`, `campaign_phone_scripts`, `campaign_materials`.
- The `deleteCampaign` mutation (line 64-76 of useCampaigns) only deletes the campaign row.
- **Fix**: Either add ON DELETE CASCADE foreign keys via migration, or add application-level cleanup before delete.

**C4. `useAuth` race condition with `sessionFetched` variable**
- `sessionFetched` (line 80) is a plain `let` variable, not a ref. The `onAuthStateChange` callback captures it as `false` in closure. The 100ms timeout `getInitialSession` may fire before or after auth state change, potentially causing double session handling.
- **Fix**: Use `useRef` for `sessionFetched`.

**C5. Dashboard `useDashboardData` uses `Cancelled` status but DB enum is `deferred`**
- Line 50 & 86: filters use `.neq('status', 'Cancelled')` and counts include `'Cancelled'` in `actionStatuses`. After the recent fix changing `cancelled` → `deferred`, this dashboard hook was NOT updated, causing incorrect task counts.
- **Fix**: Change `'Cancelled'` to `'Deferred'` in `useDashboardData.tsx`.

---

## HIGH Issues

**H1. Campaign CRUD has zero audit logging**
- `useCampaigns.tsx` has no `logCreate`, `logUpdate`, `logDelete` calls. All campaign operations are invisible to the audit log system.
- **Fix**: Add `useCRUDAudit` to the campaigns hook.

**H2. Audit logs fetch 5000 records in one query**
- `AuditLogsSettings.tsx` line 70: `.limit(5000)`. With active usage this will be slow and memory-heavy.
- **Fix**: Implement server-side pagination with cursor-based or offset pagination.

**H3. Action Items also fetch 5000 records**
- `useActionItems.tsx` line 84: `.limit(5000)`.
- Same fix needed.

**H4. Profiles table RLS blocks non-admin users from viewing other users' names**
- SELECT policy: `is_user_admin() OR (id = auth.uid())`. Non-admin users cannot resolve display names via direct profile queries. The edge function `fetch-user-display-names` likely works via service_role, but any client-side profile lookups fail silently for non-admins.
- **Fix**: Create a public view or relax the SELECT policy to allow reading `full_name` for all authenticated users.

**H5. DealsPage has redundant auth redirect**
- Lines 251-255: `useEffect` redirects to `/auth` when user is null, but `ProtectedRoute` already does this.
- **Fix**: Remove the redundant redirect.

**H6. `security_audit_log` RLS not visible — potential security risk**
- The table schema was truncated in context, but `useDashboardData` line 52 queries it without user filter (`.order('created_at', ...).limit(15)`). If RLS allows all authenticated users to SELECT, every user sees every user's audit trail. Need to verify and potentially restrict to admin-only or own-records-only.

---

## MEDIUM Issues

**M1. Dead code — 4 unused Contact table components**
- `ContactsTable.tsx`, `ContactsTableRefactored.tsx`, `ContactsTableWithActions.tsx`, `ContactsTableWithPagination.tsx` — none are imported anywhere. They increase bundle size.
- **Fix**: Delete these files.

**M2. Contacts page lacks owner/source/region filters**
- Only has a search bar. Accounts page has status and owner filters. Contacts should match.

**M3. Sidebar collapsed state not persisted**
- `FixedSidebarLayout` uses `useState(false)` — resets on every page navigation.
- **Fix**: Persist to `localStorage`.

**M4. QueryClient has no custom config**
- `new QueryClient()` with defaults means silent 3x retries, no global error handling, default stale times.
- **Fix**: Configure `defaultOptions` with appropriate retry, staleTime, and onError.

**M5. Account owner filter shows UUID fragments as fallback**
- When name resolution fails, shows `id.slice(0, 8)` like `c9ae71ae`.

**M6. `campaign_settings` uses `as any` type casting**
- Table type not in generated types, indicating types.ts is stale.

---

## LOW Issues

**L1. NotFound page wrapped in ProtectedRoute** — unauthenticated users hitting invalid routes get redirected to `/auth` instead of 404.

**L2. No loading indicator during bulk delete** in Accounts/Contacts.

**L3. `keep_alive` table has no RLS policies.**

**L4. Real-time subscription on deals doesn't handle conflicts** — two simultaneous edits could cause stale local state.

---

## Implementation Plan (Prioritized)

### Batch 1 — Critical Fixes
1. **Fix `useDashboardData.tsx`**: Change `'Cancelled'` → `'Deferred'` (2 occurrences: line 50 neq filter and line 86 actionStatuses array)
2. **Fix `useAuth.tsx` race condition**: Change `sessionFetched` from `let` to `useRef`, remove `window.location.replace` calls from auth state change (let React Router handle)
3. **Add campaign cascade deletes**: Update `deleteCampaign` to delete child records first (campaign_contacts, campaign_accounts, campaign_communications, campaign_email_templates, campaign_phone_scripts, campaign_materials)
4. **Remove redundant auth redirect** from `DealsPage.tsx`

### Batch 2 — High Priority
5. **Add audit logging to `useCampaigns.tsx`**
6. **Add pagination to audit logs and action items** (replace `.limit(5000)` with proper paginated queries)
7. **Delete dead Contact table components** (4 files)
8. **Persist sidebar state** to localStorage

### Batch 3 — Medium Priority
9. Add filters to Contacts page
10. Configure QueryClient defaults
11. Fix account owner UUID fallback display
12. Regenerate Supabase types

### Files to Modify
- `src/hooks/useDashboardData.tsx` — fix status values
- `src/hooks/useAuth.tsx` — fix race condition, remove location.replace
- `src/hooks/useCampaigns.tsx` — add cascade delete + audit logging
- `src/pages/DealsPage.tsx` — remove redundant auth redirect
- `src/App.tsx` — configure QueryClient, persist sidebar
- Delete: `src/components/ContactsTable.tsx`, `ContactsTableRefactored.tsx`, `ContactsTableWithActions.tsx`, `ContactsTableWithPagination.tsx`

