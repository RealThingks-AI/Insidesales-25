import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSecurityAudit } from '@/hooks/useSecurityAudit';

interface PagePermission {
  id: string;
  page_name: string;
  description: string | null;
  route: string;
  admin_access: boolean;
  manager_access: boolean;
  user_access: boolean;
  super_admin_access: boolean;
  sales_head_access: boolean;
  field_sales_access: boolean;
  inside_sales_access: boolean;
}

type AccessField = 'super_admin_access' | 'admin_access' | 'sales_head_access' | 'field_sales_access' | 'inside_sales_access' | 'manager_access' | 'user_access';

const roleColumns: { key: AccessField; label: string }[] = [
  { key: 'super_admin_access', label: 'Super Admin' },
  { key: 'admin_access', label: 'Admin' },
  { key: 'sales_head_access', label: 'Sales Head' },
  { key: 'field_sales_access', label: 'Field Sales' },
  { key: 'inside_sales_access', label: 'Inside Sales' },
  { key: 'manager_access', label: 'Manager' },
  { key: 'user_access', label: 'User' },
];

const PageAccessSettings = () => {
  const [permissions, setPermissions] = useState<PagePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const { logSecurityEvent } = useSecurityAudit();

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('page_permissions')
        .select('*')
        .order('page_name');
      
      if (error) throw error;
      setPermissions((data || []) as unknown as PagePermission[]);
    } catch (error) {
      console.error('Error fetching page permissions:', error);
      toast.error('Failed to load page permissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  const handleToggle = async (id: string, field: AccessField, value: boolean) => {
    setUpdating(id);
    try {
      const { error } = await supabase
        .from('page_permissions')
        .update({ [field]: value })
        .eq('id', id);
      
      if (error) throw error;
      
      const perm = permissions.find(p => p.id === id);
      setPermissions(prev => prev.map(p => 
        p.id === id ? { ...p, [field]: value } : p
      ));
      logSecurityEvent('SETTINGS_UPDATE', 'page_permissions', id, {
        page_name: perm?.page_name,
        field,
        old_value: !value,
        new_value: value
      });
      toast.success('Permission updated');
    } catch (error) {
      console.error('Error updating permission:', error);
      toast.error('Failed to update permission');
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Page</TableHead>
                <TableHead className="w-[100px]">Route</TableHead>
                {roleColumns.map(col => (
                  <TableHead key={col.key} className="text-center w-[90px] text-xs">
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissions.map((permission) => (
                <TableRow key={permission.id}>
                  <TableCell className="font-medium">
                    <div>
                      <div className="text-sm">{permission.page_name}</div>
                      {permission.description && (
                        <div className="text-xs text-muted-foreground">{permission.description}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {permission.route}
                  </TableCell>
                  {roleColumns.map(col => (
                    <TableCell key={col.key} className="text-center">
                      <Switch
                        checked={permission[col.key] ?? true}
                        onCheckedChange={(value) => handleToggle(permission.id, col.key, value)}
                        disabled={updating === permission.id}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default PageAccessSettings;
