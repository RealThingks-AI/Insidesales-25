

# Deep QA Audit Report — Current State

## Summary of Previous Fixes (Already Applied)
- ✅ `useAuth.tsx` race condition fixed (sessionFetchedRef)
- ✅ `window.location.replace` removed from useAuth (React Router handles redirects)
- ✅ Campaign cascade deletes implemented
- ✅ `useDashboardData` status fixed to `Deferred`
- ✅ DealsPage redundant auth redirect removed
- ✅ Dead ContactsTable files deleted
- ✅ QueryClient configured with retry/staleTime
- ✅ Sidebar state persisted to localStorage
- ✅ Audit logging added to useCampaigns

---

## Remaining Bugs & Issues Found

### CRITICAL

**C1. `Auth.tsx` still uses `window.location.replace("/")` on login (line 111)**
The previous fix removed it from `useAuth.tsx`, but `Auth.tsx` still has `setTimeout(() => { window.location.replace("/"); }, 500)` after successful login. This causes a full page reload, destroying React state and query cache. The `AuthRoute` component already handles redirect via `<Navigate to="/" replace />` when `user` is truthy, making this redundant and harmful.

**Fix**: Remove the `window.location.replace("/")` call from `Auth.tsx`. After successful `signInWithPassword`, the `onAuthStateChange` sets the user, and `AuthRoute` redirects.

---

**C2. `ActionItemStatus` type says `'Cancelled'` but dashboard uses `'Deferred'` — mismatch**
- `useActionItems.tsx` line 9: `export type ActionItemStatus = 'Open' | 'In Progress' | 'Completed' | 'Cancelled'`
- `useDashboardData.tsx` line 86: `['Open', 'In Progress', 'Completed', 'Deferred']`
- All UI components (ActionItemsTable, ActionItemModal, ActionItemsKanban, DealExpandedPanel, ActionItems page) use `'Cancelled'`
- DB column is plain `text` — no enum constraint. Current data only has `Open`, `In Progress`, `Completed`.

The system is inconsistent: the dashboard counts "Deferred" items but no UI ever creates them. All forms/kanban boards create "Cancelled" items.

**Fix**: Pick ONE status name and use it everywhere. Since the DB has no enum and all UI uses `Cancelled`, change `useDashboardData.tsx` back to `'Cancelled'` (2 places: line 50 `.neq('status', 'Cancelled')` and line 86 array). OR change all ~20 UI references to `Deferred`. Recommend keeping `Cancelled` since it's used in 11 files vs 1.

---

**C3. `security_audit_log` has overly permissive RLS — all users see all logs**
Two SELECT policies exist:
- "Admins can view all audit logs" → `is_user_admin()`
- "Users can view audit logs" → `true`

The second policy makes every authenticated user see ALL audit logs (every user's actions, IP addresses, user agents). This is a security/privacy risk.

**Fix**: Drop the "Users can view audit logs" policy, or change it to `user_id = auth.uid()` so users only see their own audit trail.

---

### HIGH

**H1. Profiles RLS blocks non-admin users from viewing other users' names**
SELECT policy: `is_user_admin() OR (id = auth.uid())`. Non-admin users querying profiles for display names get empty results. The edge function `fetch-user-display-names` uses service_role so it works, but any direct client queries fail. Components that try to resolve names via direct profile queries will show UUIDs or "Unknown" for non-admin users.

**Fix**: Add a relaxed SELECT policy that allows all authenticated users to read `full_name` and `avatar_url`. Either:
- Broaden the existing policy to allow SELECT for all authenticated users
- Or create a view exposing only non-sensitive columns

**H2. No signup flow — Auth page only has "Sign In"**
The Auth page (line 136-184) only has a sign-in form. No signup button, no password reset link. New users can only be created by admins via UserManagement. If this is intentional (admin-only user creation), it's fine but should be documented. If users need self-registration, it's missing.

**H3. `keep_alive` table has RLS enabled but NO policies**
The `keep_alive` table has zero RLS policies, meaning no one (except service_role) can read or write to it. If any client code tries to access it, it will silently fail.

---

### MEDIUM

**M1. `as any` type casting throughout useCampaigns.tsx (80 occurrences)**
Supabase types are stale — campaign tables aren't in the generated types, so every query uses `as any`. This hides type errors and makes the code fragile. Regenerating types would fix this.

**M2. DealsPage uses `fetchAllRecords` — loads ALL deals at once**
With only 57 deals currently, this works fine. But the architecture won't scale. The kanban view inherently needs all deals visible (no good way to paginate a kanban), so this is acceptable for kanban. The list view should use server-side pagination but currently doesn't.

**M3. Action items with `showArchived: false` filter doesn't filter by archived_at**
In `useActionItems.tsx`, the `showArchived` filter exists but looking at line 100+, it may not actually filter `archived_at IS NULL`. Need to verify the query builder handles this.

**M4. Campaign `cloneCampaign` doesn't clone contacts or accounts**
The clone mutation (lines 92-156) clones email templates and phone scripts but NOT campaign_contacts or campaign_accounts. Users duplicating a campaign lose their contact/account lists.

---

### LOW

**L1. NotFound page requires authentication** — wrapped in `ProtectedRoute`, so unauthenticated users get redirected to `/auth` instead of seeing 404.

**L2. No loading indicator during bulk operations** in Accounts/Contacts.

**L3. `user_sessions` table exists but `useAuth.tsx` doesn't use session tracking** — the reference file shows session tracking code, but the current `useAuth.tsx` doesn't have `trackSession`/`deactivateSession` functions. Session management settings may show stale/incomplete data.

---

## Recommended Implementation Plan

### Batch 1 — Critical (Fix Now)
1. **Remove `window.location.replace` from `Auth.tsx`** — let `AuthRoute` handle redirect after `onAuthStateChange` sets the user
2. **Standardize action item status** — change `useDashboardData.tsx` to use `'Cancelled'` (matching the 11 other files) instead of `'Deferred'`
3. **Fix `security_audit_log` RLS** — drop the permissive "Users can view audit logs" policy, replace with `user_id = auth.uid()` so users only see their own logs

### Batch 2 — High Priority
4. **Fix profiles RLS** — add a SELECT policy allowing all authenticated users to read `full_name` and `avatar_url` columns (or add a broader SELECT for all authenticated)
5. **Fix campaign clone** — add contacts and accounts cloning to `cloneCampaign`

### Batch 3 — Medium
6. **Verify `showArchived` filter** in useActionItems actually works
7. Consider regenerating Supabase types to eliminate `as any` casting

### Files to Modify
- `src/pages/Auth.tsx` — remove window.location.replace
- `src/hooks/useDashboardData.tsx` — change Deferred → Cancelled
- `src/hooks/useCampaigns.tsx` — add contacts/accounts to cloneCampaign
- DB migration: fix `security_audit_log` SELECT policy, optionally fix `profiles` SELECT policy

