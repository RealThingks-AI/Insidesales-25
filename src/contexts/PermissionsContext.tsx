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
  super_admin_access: boolean;
  sales_head_access: boolean;
  field_sales_access: boolean;
  inside_sales_access: boolean;
}

interface PermissionsContextType {
  userRole: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isManager: boolean;
  isSalesHead: boolean;
  isFieldSales: boolean;
  isInsideSales: boolean;
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
    staleTime: 5 * 60 * 1000,
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
      
      return (data as unknown) as PagePermission[];
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
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
    const normalizedRoute = route === '/' ? '/dashboard' : route.replace(/\/$/, '');
    const permission = permissions.find(p => p.route === normalizedRoute);
    
    // If no permission record exists, allow access by default
    if (!permission) {
      return true;
    }

    switch (userRole) {
      case 'super_admin':
        return permission.super_admin_access;
      case 'admin':
        return permission.admin_access;
      case 'sales_head':
        return permission.sales_head_access;
      case 'field_sales':
        return permission.field_sales_access;
      case 'inside_sales':
        return permission.inside_sales_access;
      case 'manager':
        return permission.manager_access;
      case 'user':
      default:
        return permission.user_access;
    }
  }, [permissions, userRole]);

  const isSuperAdmin = userRole === 'super_admin';
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';
  const isManager = userRole === 'manager';
  const isSalesHead = userRole === 'sales_head';
  const isFieldSales = userRole === 'field_sales';
  const isInsideSales = userRole === 'inside_sales';

  // Only show loading on initial load when there's no cached data
  const loading = authLoading || ((roleLoading || permissionsLoading) && !roleData);

  const value = useMemo(() => ({
    userRole,
    isAdmin,
    isSuperAdmin,
    isManager,
    isSalesHead,
    isFieldSales,
    isInsideSales,
    permissions,
    loading,
    hasPageAccess,
    refreshPermissions,
  }), [userRole, isAdmin, isSuperAdmin, isManager, isSalesHead, isFieldSales, isInsideSales, permissions, loading, hasPageAccess, refreshPermissions]);

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
};
