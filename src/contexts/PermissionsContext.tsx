import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface PagePermission {
  id: string;
  page_name: string;
  route: string;
  admin_access: boolean;
  manager_access: boolean;
  user_access: boolean;
}

interface PermissionsContextType {
  userRole: string;
  isAdmin: boolean;
  isManager: boolean;
  permissions: PagePermission[];
  loading: boolean;
  hasPageAccess: (route: string) => boolean;
  refreshPermissions: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within PermissionsProvider');
  }
  return context;
};

interface PermissionsProviderProps {
  children: React.ReactNode;
}

export const PermissionsProvider = ({ children }: PermissionsProviderProps) => {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user role from user_roles table
  const { data: roleData, isLoading: roleLoading } = useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user?.id) return { role: 'user' };
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching user role:', error);
        return { role: 'user' };
      }
      
      return { role: data?.role || 'user' };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
  });

  // Fetch page permissions
  const { data: permissionsData, isLoading: permissionsLoading } = useQuery({
    queryKey: ['page-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('page_permissions')
        .select('*');
      
      if (error) {
        console.error('Error fetching page permissions:', error);
        return [];
      }
      
      return data as PagePermission[];
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000,
  });

  const userRole = roleData?.role || 'user';
  const permissions = permissionsData || [];

  const refreshPermissions = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['user-role', user?.id] }),
      queryClient.invalidateQueries({ queryKey: ['page-permissions'] }),
    ]);
  }, [queryClient, user?.id]);

  const hasPageAccess = useCallback((route: string): boolean => {
    // Normalize route
    const normalizedRoute = route === '/' ? '/dashboard' : route.replace(/\/$/, '');
    
    // Find permission for this route
    const permission = permissions.find(p => p.route === normalizedRoute);
    
    // If no permission record exists, allow access by default
    if (!permission) {
      return true;
    }

    // Check access based on role
    switch (userRole) {
      case 'admin':
        return permission.admin_access;
      case 'manager':
        return permission.manager_access;
      case 'user':
      default:
        return permission.user_access;
    }
  }, [permissions, userRole]);

  const isAdmin = userRole === 'admin';
  const isManager = userRole === 'manager';

  // Only show loading on initial load when there's no cached data
  const loading = authLoading || ((roleLoading || permissionsLoading) && !roleData);

  const value = useMemo(() => ({
    userRole,
    isAdmin,
    isManager,
    permissions,
    loading,
    hasPageAccess,
    refreshPermissions,
  }), [userRole, isAdmin, isManager, permissions, loading, hasPageAccess, refreshPermissions]);

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
};
