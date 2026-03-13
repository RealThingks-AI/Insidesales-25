import { usePermissions } from '@/contexts/PermissionsContext';

/**
 * @deprecated Use usePermissions() from PermissionsContext instead for better performance.
 * This hook is kept for backward compatibility.
 */
export const useUserRole = () => {
  const { userRole, isAdmin, isManager, loading, refreshPermissions } = usePermissions();

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
    refreshRole: refreshPermissions
  };
};
