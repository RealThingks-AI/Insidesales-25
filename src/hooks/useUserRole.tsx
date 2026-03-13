import { usePermissions } from '@/contexts/PermissionsContext';

export const useUserRole = () => {
  const { userRole, isAdmin, isSuperAdmin, isManager, isSalesHead, isFieldSales, isInsideSales, loading, refreshPermissions } = usePermissions();

  const canEdit = isAdmin || isManager || isSalesHead || isFieldSales;
  const canDelete = isAdmin;
  const canManageUsers = isAdmin;
  const canAccessSettings = isAdmin;

  return {
    userRole,
    isAdmin,
    isSuperAdmin,
    isManager,
    isSalesHead,
    isFieldSales,
    isInsideSales,
    canEdit,
    canDelete,
    canManageUsers,
    canAccessSettings,
    loading,
    refreshRole: refreshPermissions
  };
};
