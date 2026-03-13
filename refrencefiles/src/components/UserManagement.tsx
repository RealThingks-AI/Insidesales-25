import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Plus, RefreshCw, Shield, ShieldAlert, User, Key, Upload, Search, Edit, Eye, Link2, UserCog, Trash2, ArrowUpDown, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import UserModal from "./UserModal";
import EditUserModal from "./EditUserModal";
import ChangeRoleModal from "./ChangeRoleModal";
import DeleteUserDialog from "./DeleteUserDialog";
import SetPasswordModal from "./SetPasswordModal";
interface UserData {
  id: string;
  email: string;
  user_metadata: {
    full_name?: string;
  };
  created_at: string;
  last_sign_in_at: string | null;
  banned_until?: string | null;
  role?: string;
}
const UserManagement = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const {
    toast
  } = useToast();
  const {
    refreshUser
  } = useAuth();
  const {
    isAdmin,
    loading: roleLoading,
    userRole
  } = useUserRole();
  console.log('UserManagement - Current user role:', userRole, 'isAdmin:', isAdmin, 'loading:', roleLoading);
  const fetchUsers = useCallback(async () => {
    try {
      console.log('Fetching users with role validation...');

      // Fetch users and roles in parallel for faster loading
      const [usersResponse, rolesResponse] = await Promise.all([supabase.functions.invoke('user-admin', {
        method: 'GET'
      }), supabase.from('user_roles').select('user_id, role')]);
      if (usersResponse.error) {
        console.error('Error fetching users:', usersResponse.error);
        throw usersResponse.error;
      }

      // Build roles lookup map
      const userRoles: Record<string, string> = {};
      if (rolesResponse.data) {
        rolesResponse.data.forEach((item: any) => {
          userRoles[item.user_id] = item.role;
        });
      }

      // Combine user data with roles
      const usersWithRoles = usersResponse.data.users?.map((user: any) => ({
        ...user,
        role: userRoles[user.id] || 'user'
      })) || [];
      console.log('Users fetched successfully:', usersWithRoles.length);
      setUsers(usersWithRoles);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch users",
        variant: "destructive"
      });
    }
  }, [toast]);
  const syncAndRefresh = useCallback(async () => {
    try {
      setRefreshing(true);

      // Refresh session first
      const {
        error: refreshError
      } = await supabase.auth.refreshSession();
      if (refreshError) {
        throw new Error("Failed to refresh session");
      }

      // Fetch latest users
      await fetchUsers();

      // Refresh current user data
      await refreshUser();
      toast({
        title: "Success",
        description: "User data synced successfully"
      });
    } catch (error: any) {
      toast({
        title: "Sync Error",
        description: error.message || "Failed to sync data",
        variant: "destructive"
      });
    } finally {
      setRefreshing(false);
    }
  }, [fetchUsers, refreshUser, toast]);
  const handleEditUser = useCallback((user: UserData) => {
    setSelectedUser(user);
    setShowEditModal(true);
  }, []);
  const handleChangeRole = useCallback((user: UserData) => {
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only Admins can change user roles.",
        variant: "destructive"
      });
      return;
    }
    setSelectedUser(user);
    setShowRoleModal(true);
  }, [isAdmin, toast]);
  const handleSetPassword = useCallback((user: UserData) => {
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only Admins can reset user passwords.",
        variant: "destructive"
      });
      return;
    }
    setSelectedUser(user);
    setShowSetPasswordModal(true);
  }, [isAdmin, toast]);
  const handleToggleUserStatus = useCallback(async (user: UserData) => {
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only Admins can activate/deactivate users.",
        variant: "destructive"
      });
      return;
    }
    try {
      const action = user.banned_until ? 'activate' : 'deactivate';
      toast({
        title: "Processing",
        description: `${action === 'activate' ? 'Activating' : 'Deactivating'} user...`
      });
      const {
        data,
        error
      } = await supabase.functions.invoke('user-admin', {
        method: 'PUT',
        body: {
          userId: user.id,
          action: action
        }
      });
      if (error) throw error;
      toast({
        title: "Success",
        description: `User ${action}d successfully`
      });
      await fetchUsers();
      await refreshUser();
    } catch (error: any) {
      console.error('Error updating user status:', error);
      if (error.message?.includes('Only Admins can')) {
        toast({
          title: "Access Denied",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to update user status",
          variant: "destructive"
        });
      }
    }
  }, [fetchUsers, refreshUser, toast, isAdmin]);
  const handleDeleteUser = useCallback((user: UserData) => {
    if (!isAdmin) {
      toast({
        title: "Access Denied",
        description: "Only Admins can delete users.",
        variant: "destructive"
      });
      return;
    }
    setSelectedUser(user);
    setShowDeleteDialog(true);
  }, [isAdmin, toast]);
  const handleUserSuccess = useCallback(async () => {
    await fetchUsers();
    await refreshUser();
  }, [fetchUsers, refreshUser]);
  const getRoleBadgeColor = useCallback((role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'bg-rose-500 hover:bg-rose-600';
      case 'manager':
        return 'bg-blue-600 hover:bg-blue-700';
      default:
        return 'bg-slate-600 hover:bg-slate-700';
    }
  }, []);
  const getRoleLabel = useCallback((role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'Admin';
      case 'manager':
        return 'Manager';
      default:
        return 'User';
    }
  }, []);
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  const filteredAndSortedUsers = users.filter(user => {
    const searchLower = searchQuery.toLowerCase();
    const name = user.user_metadata?.full_name || user.email.split('@')[0];
    return name.toLowerCase().includes(searchLower) || user.email.toLowerCase().includes(searchLower);
  }).sort((a, b) => {
    let aVal: any, bVal: any;
    switch (sortField) {
      case 'name':
        aVal = a.user_metadata?.full_name || a.email;
        bVal = b.user_metadata?.full_name || b.email;
        break;
      case 'email':
        aVal = a.email;
        bVal = b.email;
        break;
      case 'role':
        aVal = a.role || 'user';
        bVal = b.role || 'user';
        break;
      case 'last_sign_in_at':
        aVal = a.last_sign_in_at || '';
        bVal = b.last_sign_in_at || '';
        break;
      case 'created_at':
      default:
        aVal = a.created_at;
        bVal = b.created_at;
    }
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(filteredAndSortedUsers.map(u => u.id));
    } else {
      setSelectedUsers([]);
    }
  };
  const handleSelectUser = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers([...selectedUsers, userId]);
    } else {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    }
  };
  useEffect(() => {
    const loadData = async () => {
      // Wait for role to be loaded
      if (roleLoading) return;
      console.log('UserManagement useEffect - isAdmin:', isAdmin, 'roleLoading:', roleLoading);
      setLoading(true);
      if (isAdmin) {
        await fetchUsers();
      }
      setLoading(false);
    };
    loadData();
  }, [fetchUsers, isAdmin, roleLoading]);

  // Show loading while checking user role
  if (roleLoading) {
    console.log('UserManagement - Role loading...');
    return <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            User & Access Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>;
  }
  if (!isAdmin) {
    console.log('UserManagement - Access denied, isAdmin:', isAdmin);
    return <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            User & Access Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Access Denied</h3>
            <p className="text-muted-foreground">Only administrators can access user management.</p>
            <p className="text-xs text-muted-foreground mt-2">Current role: {userRole}</p>
          </div>
        </CardContent>
      </Card>;
  }
  if (loading) {
    return <Card>
        <CardHeader>
          <CardTitle>User & Access Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>;
  }
  return <TooltipProvider>
      <>
        <div className="space-y-4">
          {/* Header with actions */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">User & Access Management</h2>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>
                    <Button variant="outline" size="sm" disabled>
                      <Upload className="h-4 w-4 mr-2" />
                      Bulk Import
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Coming soon - Import users via CSV</p>
                </TooltipContent>
              </Tooltip>
              <Button variant="outline" size="sm" onClick={syncAndRefresh} disabled={refreshing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button size="sm" onClick={() => setShowAddModal(true)}>
                <UserCog className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </div>
          </div>

          {/* User Directory Card */}
          <Card>
            
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-12">
                      <Checkbox checked={selectedUsers.length === filteredAndSortedUsers.length && filteredAndSortedUsers.length > 0} onCheckedChange={handleSelectAll} />
                    </TableHead>
                    <TableHead className="cursor-pointer group" onClick={() => handleSort('name')}>
                      <div className="flex items-center gap-1">
                        Display Name
                        <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer group" onClick={() => handleSort('email')}>
                      <div className="flex items-center gap-1">
                        Email
                        <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer group" onClick={() => handleSort('role')}>
                      <div className="flex items-center gap-1">
                        Role
                        <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="cursor-pointer group" onClick={() => handleSort('last_sign_in_at')}>
                      <div className="flex items-center gap-1">
                        Last Login
                        <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </TableHead>
                    <TableHead className="cursor-pointer group" onClick={() => handleSort('created_at')}>
                      <div className="flex items-center gap-1">
                        Created At
                        <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedUsers.map(user => <TableRow key={user.id} data-state={selectedUsers.includes(user.id) ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox checked={selectedUsers.includes(user.id)} onCheckedChange={checked => handleSelectUser(user.id, checked as boolean)} />
                      </TableCell>
                      <TableCell className="font-medium">
                        {user.user_metadata?.full_name || user.email.split('@')[0]}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Badge className={`${getRoleBadgeColor(user.role || 'user')} text-white`}>
                          {getRoleLabel(user.role || 'user')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.banned_until ? 'destructive' : 'default'} className={user.banned_until ? '' : 'bg-green-500 hover:bg-green-600'}>
                          {user.banned_until ? 'Inactive' : 'Active'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.last_sign_in_at ? format(new Date(user.last_sign_in_at), 'dd/MM/yyyy') : '—'}
                      </TableCell>
                      <TableCell>
                        {format(new Date(user.created_at), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditUser(user)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit User
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleUserStatus(user)}>
                                <Eye className="h-4 w-4 mr-2" />
                                {user.banned_until ? 'Activate' : 'Deactivate'}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleSetPassword(user)}>
                                <Link2 className="h-4 w-4 mr-2" />
                                Set Password
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleChangeRole(user)}>
                                <UserCog className="h-4 w-4 mr-2" />
                                Change Role
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteUser(user)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete User</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>)}
                </TableBody>
              </Table>
              
              {filteredAndSortedUsers.length === 0 && <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    {searchQuery ? 'No users found matching your search' : 'No users found'}
                  </p>
                </div>}
            </CardContent>
          </Card>
        </div>

        <UserModal open={showAddModal} onClose={() => setShowAddModal(false)} onSuccess={handleUserSuccess} />
        
        <EditUserModal open={showEditModal} onClose={() => setShowEditModal(false)} user={selectedUser} onSuccess={handleUserSuccess} />
        
        <ChangeRoleModal open={showRoleModal} onClose={() => setShowRoleModal(false)} user={selectedUser} onSuccess={handleUserSuccess} />
        
        <DeleteUserDialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)} user={selectedUser} onSuccess={handleUserSuccess} />
        
        <SetPasswordModal open={showSetPasswordModal} onClose={() => setShowSetPasswordModal(false)} user={selectedUser} onSuccess={handleUserSuccess} />
      </>
    </TooltipProvider>;
};
export default UserManagement;