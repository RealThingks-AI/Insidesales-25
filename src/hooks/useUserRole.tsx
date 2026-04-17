import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const useUserRole = () => {
  const [userRole, setUserRole] = useState<string>('user');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchUserRole = useCallback(async () => {
    if (!user) {
      setUserRole('user');
      setLoading(false);
      return;
    }

    try {
      console.log('Fetching role for user:', user.email);
      
      // First check user_roles table (proper role storage)
      const { data: roleData, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching role from user_roles:', error);
        // Fallback to user metadata
        const role = user.user_metadata?.role || 'user';
        console.log('User role from metadata (fallback):', role);
        setUserRole(role);
      } else if (roleData) {
        console.log('User role from user_roles table:', roleData.role);
        setUserRole(roleData.role);
      } else {
        // No role in table, check metadata
        const role = user.user_metadata?.role || 'user';
        console.log('User role from metadata:', role);
        setUserRole(role);
      }
    } catch (error) {
      console.error('Error in fetchUserRole:', error);
      setUserRole('user');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUserRole();
  }, [fetchUserRole]);

  const refreshRole = useCallback(async () => {
    setLoading(true);
    await fetchUserRole();
  }, [fetchUserRole]);

  const isAdmin = userRole === 'admin';
  const isManager = userRole === 'manager';
  const canEdit = isAdmin || isManager;
  const canDelete = isAdmin;
  const canManageUsers = isAdmin;
  const canAccessSettings = isAdmin;

  return {
    userRole,
    isAdmin,
    isManager,
    canEdit,
    canDelete,
    canManageUsers,
    canAccessSettings,
    loading,
    refreshRole
  };
};
