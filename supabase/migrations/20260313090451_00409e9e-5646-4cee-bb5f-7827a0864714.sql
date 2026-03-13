-- Drop policies that depend on is_current_user_admin_by_metadata
DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON user_roles;

-- Drop the insecure function
DROP FUNCTION IF EXISTS public.is_current_user_admin_by_metadata();

-- Recreate the policies using is_current_user_admin() instead
CREATE POLICY "Admins can view all roles" ON user_roles
  FOR SELECT TO authenticated
  USING (is_current_user_admin() OR user_id = auth.uid());

CREATE POLICY "Admins can manage all roles" ON user_roles
  FOR ALL TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());