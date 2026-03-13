
-- Fix security_audit_log: drop the overly permissive policy and replace with user-scoped one
DROP POLICY IF EXISTS "Users can view audit logs" ON public.security_audit_log;

CREATE POLICY "Users can view own audit logs"
ON public.security_audit_log
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Fix profiles: allow all authenticated users to SELECT (for display name resolution)
DROP POLICY IF EXISTS "Users can view their own profile or admins can view all" ON public.profiles;

CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);
