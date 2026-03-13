import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Search, Lock, ShieldAlert, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface PagePermission {
  id: string;
  page_name: string;
  description: string;
  route: string;
  admin_access: boolean;
  manager_access: boolean;
  user_access: boolean;
  updated_at: string;
}

const PageAccessSettings = () => {
  const [permissions, setPermissions] = useState<PagePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const { isAdmin, loading: roleLoading } = useUserRole();

  const fetchPermissions = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('page_permissions')
        .select('*')
        .order('page_name');

      if (error) throw error;
      setPermissions(data || []);
    } catch (error: any) {
      console.error('Error fetching page permissions:', error);
      toast.error('Failed to fetch page permissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!roleLoading && isAdmin) {
      fetchPermissions();
    } else if (!roleLoading) {
      setLoading(false);
    }
  }, [fetchPermissions, isAdmin, roleLoading]);

  const handleToggleAccess = async (
    permissionId: string, 
    role: 'admin' | 'manager' | 'user',
    currentValue: boolean
  ) => {
    if (!isAdmin) {
      toast.error('Only admins can modify page permissions');
      return;
    }

    setUpdating(`${permissionId}-${role}`);

    try {
      const updateField = `${role}_access`;
      const { error } = await supabase
        .from('page_permissions')
        .update({ [updateField]: !currentValue })
        .eq('id', permissionId);

      if (error) throw error;

      setPermissions(prev => prev.map(p => 
        p.id === permissionId 
          ? { ...p, [updateField]: !currentValue, updated_at: new Date().toISOString() }
          : p
      ));

      toast.success('Permission updated successfully');
    } catch (error: any) {
      console.error('Error updating permission:', error);
      toast.error('Failed to update permission');
    } finally {
      setUpdating(null);
    }
  };

  const filteredPermissions = permissions.filter(p =>
    p.page_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.route.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (roleLoading || loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Page Access Control
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Page Access Control
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Access Denied</h3>
            <p className="text-muted-foreground">Only administrators can manage page access permissions.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Page Access Control
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Permissions Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[150px]">Page Name</TableHead>
                <TableHead className="w-[250px]">Description</TableHead>
                <TableHead className="w-[120px]">Route</TableHead>
                <TableHead className="text-center w-[100px]">Admin</TableHead>
                <TableHead className="text-center w-[100px]">Manager</TableHead>
                <TableHead className="text-center w-[100px]">User</TableHead>
                <TableHead className="w-[120px]">Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPermissions.map((permission) => (
                <TableRow key={permission.id}>
                  <TableCell className="font-medium">{permission.page_name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {permission.description}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {permission.route}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={permission.admin_access}
                      onCheckedChange={() => handleToggleAccess(permission.id, 'admin', permission.admin_access)}
                      disabled={updating === `${permission.id}-admin`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={permission.manager_access}
                      onCheckedChange={() => handleToggleAccess(permission.id, 'manager', permission.manager_access)}
                      disabled={updating === `${permission.id}-manager`}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={permission.user_access}
                      onCheckedChange={() => handleToggleAccess(permission.id, 'user', permission.user_access)}
                      disabled={updating === `${permission.id}-user`}
                    />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(permission.updated_at), 'dd/MM/yyyy')}
                  </TableCell>
                </TableRow>
              ))}
              {filteredPermissions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No pages found matching your search
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default PageAccessSettings;
