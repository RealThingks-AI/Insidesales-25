import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Download, Search, AlertTriangle, Activity, FileText, Undo, 
  Calendar, ChevronDown, Shield, UserCheck, Database, Settings,
  Clock, AlertCircle, Info, CheckCircle, Eye, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RevertConfirmDialog } from "@/components/feeds/RevertConfirmDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: any;
  ip_address?: string;
  created_at: string;
}

interface ResolvedNames {
  users: Record<string, string>;
  records: Record<string, Record<string, string>>;
}

type ValidTableName = 'contacts' | 'deals' | 'leads' | 'accounts' | 'tasks' | 'meetings';

// Date preset options
const DATE_PRESETS = [
  { label: 'Today', days: 0 },
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 90 Days', days: 90 },
  { label: 'All Time', days: -1 },
];

// Resource type options for filtering
const RESOURCE_TYPES = [
  { value: 'all', label: 'All Modules' },
  { value: 'contacts', label: 'Contacts' },
  { value: 'leads', label: 'Leads' },
  { value: 'deals', label: 'Deals' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'meetings', label: 'Meetings' },
  { value: 'settings', label: 'Settings' },
  { value: 'auth', label: 'Authentication' },
];

// Field name formatting helper
const formatFieldName = (field: string): string => {
  const specialMappings: Record<string, string> = {
    'contact_owner': 'Contact Owner',
    'lead_owner': 'Lead Owner',
    'account_owner': 'Account Owner',
    'created_by': 'Created By',
    'modified_by': 'Modified By',
    'assigned_to': 'Assigned To',
    'lead_status': 'Lead Status',
    'contact_source': 'Contact Source',
    'company_name': 'Company Name',
    'lead_name': 'Lead Name',
    'contact_name': 'Contact Name',
    'deal_name': 'Deal Name',
    'phone_no': 'Phone Number',
    'created_time': 'Created Time',
    'modified_time': 'Modified Time',
    'total_contract_value': 'Total Contract Value',
    'expected_closing_date': 'Expected Closing Date',
    'email_id': 'Email ID',
    'is_active': 'Active Status',
    'is_recurring': 'Is Recurring',
  };
  
  if (specialMappings[field]) return specialMappings[field];
  
  return field
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
};

const AuditLogsSettings = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [resolvedNames, setResolvedNames] = useState<ResolvedNames>({ users: {}, records: {} });
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [reverting, setReverting] = useState(false);
  const [showSessionLogs, setShowSessionLogs] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // Date range state
  const [datePreset, setDatePreset] = useState('7');
  const [startDate, setStartDate] = useState<Date | undefined>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  useEffect(() => {
    if (logs.length > 0) {
      resolveAllNames();
    }
  }, [logs]);

  useEffect(() => {
    filterLogs();
  }, [logs, searchTerm, actionFilter, resourceFilter, startDate, endDate, showSessionLogs, resolvedNames]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, actionFilter, resourceFilter, startDate, endDate, showSessionLogs]);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);

      // Supabase/PostgREST responses are capped at 1000 rows per request.
      // Fetch all rows in batches to ensure we always load the full audit trail.
      const BATCH_SIZE = 1000;
      const MAX_ROWS_SAFETY = 100000; // safety guard to avoid accidental infinite loops

      let from = 0;
      const allRows: any[] = [];

      while (true) {
        const { data, error } = await supabase
          .from('security_audit_log')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + BATCH_SIZE - 1);

        if (error) throw error;

        const batch = data || [];
        allRows.push(...batch);

        if (batch.length < BATCH_SIZE) break;

        from += BATCH_SIZE;
        if (from >= MAX_ROWS_SAFETY) {
          console.warn(
            `[AuditLogsSettings] Reached MAX_ROWS_SAFETY (${MAX_ROWS_SAFETY}). Stopping further fetches.`
          );
          break;
        }
      }

      const transformedLogs: AuditLog[] = allRows.map((log) => ({
        id: log.id,
        user_id: log.user_id || '',
        action: log.action,
        resource_type: log.resource_type,
        resource_id: log.resource_id || undefined,
        details: log.details || undefined,
        ip_address: log.ip_address ? String(log.ip_address) : undefined,
        created_at: log.created_at,
      }));

      setLogs(transformedLogs);
    } catch (error: any) {
      console.error('Error fetching audit logs:', error);
      toast({
        title: "Error",
        description: "Failed to fetch audit logs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Resolve all UUIDs to human-readable names
  const resolveAllNames = async () => {
    try {
      // Collect all user IDs
      const userIds = new Set<string>();
      const recordIds: Record<string, Set<string>> = {};

      logs.forEach(log => {
        if (log.user_id) userIds.add(log.user_id);
        
        // Collect resource IDs by type
        if (log.resource_id && log.resource_type) {
          if (!recordIds[log.resource_type]) {
            recordIds[log.resource_type] = new Set();
          }
          recordIds[log.resource_type].add(log.resource_id);
        }

        // Collect user IDs from details
        if (log.details) {
          const userFields = ['contact_owner', 'lead_owner', 'account_owner', 'created_by', 'modified_by', 'assigned_to'];
          userFields.forEach(field => {
            if (log.details[field] && isValidUUID(log.details[field])) {
              userIds.add(log.details[field]);
            }
            // Also check field_changes
            if (log.details.field_changes?.[field]) {
              const change = log.details.field_changes[field];
              if (change.old && isValidUUID(change.old)) userIds.add(change.old);
              if (change.new && isValidUUID(change.new)) userIds.add(change.new);
            }
          });
        }
      });

      // Fetch user names
      const userNames: Record<string, string> = {};
      const uniqueUserIds = Array.from(userIds).filter(Boolean);
      
      if (uniqueUserIds.length > 0) {
        try {
          const { data, error } = await supabase.functions.invoke('fetch-user-display-names', {
            body: { userIds: uniqueUserIds }
          });
          if (!error && data?.userDisplayNames) {
            Object.assign(userNames, data.userDisplayNames);
          }
        } catch {
          // Fallback: fetch from profiles
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, "Email ID"')
            .in('id', uniqueUserIds);
          
          profiles?.forEach(p => {
            userNames[p.id] = p.full_name || p['Email ID'] || 'Unknown User';
          });
        }
      }

      // Fetch record names
      const recordNames: Record<string, Record<string, string>> = {};
      
      const tableNameFields: Record<string, string> = {
        contacts: 'contact_name',
        leads: 'lead_name',
        deals: 'deal_name',
        accounts: 'company_name',
        tasks: 'title',
        meetings: 'subject',
      };

      for (const [table, ids] of Object.entries(recordIds)) {
        if (!tableNameFields[table]) continue;
        
        const uniqueIds = Array.from(ids);
        if (uniqueIds.length === 0) continue;

        try {
          const { data } = await supabase
            .from(table as ValidTableName)
            .select(`id, ${tableNameFields[table]}`)
            .in('id', uniqueIds);
          
          if (data) {
            recordNames[table] = {};
            data.forEach((record: any) => {
              recordNames[table][record.id] = record[tableNameFields[table]] || 'Unknown';
            });
          }
        } catch (e) {
          console.log(`Could not fetch names for ${table}`);
        }
      }

      setResolvedNames({ users: userNames, records: recordNames });
    } catch (error) {
      console.error('Error resolving names:', error);
    }
  };

  const isValidUUID = (str: string): boolean => {
    if (!str || typeof str !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  const getUserName = (userId: string): string => {
    if (!userId) return 'System';
    return resolvedNames.users[userId] || 'Unknown User';
  };

  const getRecordName = (resourceType: string, resourceId: string): string => {
    if (!resourceId || !resourceType) return '';
    return resolvedNames.records[resourceType]?.[resourceId] || '';
  };

  const resolveValue = (value: any, fieldName: string): string => {
    if (value === null || value === undefined) return 'Empty';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    
    // Check if it's a user ID field
    const userFields = ['contact_owner', 'lead_owner', 'account_owner', 'created_by', 'modified_by', 'assigned_to'];
    if (userFields.includes(fieldName) && isValidUUID(String(value))) {
      return resolvedNames.users[value] || String(value);
    }
    
    return String(value);
  };

  const handleDatePresetChange = (days: string) => {
    setDatePreset(days);
    const daysNum = parseInt(days);
    if (daysNum === -1) {
      setStartDate(undefined);
      setEndDate(undefined);
    } else if (daysNum === 0) {
      setStartDate(startOfDay(new Date()));
      setEndDate(endOfDay(new Date()));
    } else {
      setStartDate(subDays(new Date(), daysNum));
      setEndDate(new Date());
    }
  };

  const filterLogs = () => {
    let filtered = logs;

    // Date range filter
    if (startDate && endDate) {
      filtered = filtered.filter(log => {
        const logDate = new Date(log.created_at);
        return isWithinInterval(logDate, { 
          start: startOfDay(startDate), 
          end: endOfDay(endDate) 
        });
      });
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(log => {
        const userName = getUserName(log.user_id).toLowerCase();
        const recordName = getRecordName(log.resource_type, log.resource_id || '').toLowerCase();
        return (
          log.action.toLowerCase().includes(term) ||
          log.resource_type.toLowerCase().includes(term) ||
          userName.includes(term) ||
          recordName.includes(term) ||
          JSON.stringify(log.details).toLowerCase().includes(term)
        );
      });
    }

    // Action type filter
    if (actionFilter !== 'all') {
      filtered = filtered.filter(log => {
        switch (actionFilter) {
          case 'user_management':
            return ['USER_CREATED', 'USER_DELETED', 'USER_ACTIVATED', 'USER_DEACTIVATED', 'ROLE_CHANGE', 'PASSWORD_RESET', 'ADMIN_ACTION', 'USER_ROLE_UPDATED', 'USER_STATUS_CHANGED', 'NEW_USER_REGISTERED'].includes(log.action) || 
                   log.action.includes('USER_') || log.action.includes('ROLE_') || 
                   log.resource_type === 'user_roles' || log.resource_type === 'profiles' || log.resource_type === 'user_management';
          case 'record_changes':
            return ['CREATE', 'UPDATE', 'DELETE', 'BULK_CREATE', 'BULK_UPDATE', 'BULK_DELETE'].includes(log.action);
          case 'authentication':
            return log.action.includes('SESSION_') || log.action.includes('LOGIN') || log.action.includes('LOGOUT') || log.action.includes('AUTH') || log.resource_type === 'auth';
          case 'export':
            return log.action.includes('EXPORT') || log.action.includes('DATA_EXPORT') || log.action.includes('IMPORT') || log.action.includes('DATA_IMPORT');
          case 'settings':
            return log.action.includes('SETTINGS_') || log.resource_type.includes('settings') || log.resource_type === 'branding' || log.resource_type === 'announcements' || log.resource_type === 'email_templates';
          default:
            return true;
        }
      });
    }

    // Resource type filter
    if (resourceFilter !== 'all') {
      filtered = filtered.filter(log => {
        if (resourceFilter === 'settings') {
          return log.resource_type.includes('settings') || log.resource_type === 'branding' || log.resource_type === 'announcements' || log.resource_type === 'email_templates';
        }
        if (resourceFilter === 'auth') {
          return log.resource_type === 'auth' || log.action.includes('SESSION_') || log.action.includes('LOGIN');
        }
        return log.resource_type === resourceFilter;
      });
    }

    // Filter session logs if not showing them
    if (!showSessionLogs) {
      filtered = filtered.filter(log => 
        !log.action.includes('SESSION_ACTIVE') && 
        !log.action.includes('SESSION_INACTIVE') &&
        !log.action.includes('SESSION_START') &&
        !log.action.includes('SESSION_END')
      );
    }

    setFilteredLogs(filtered);
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredLogs.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredLogs.length);
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

  const exportAuditTrail = async () => {
    try {
      const csvContent = [
        ['Timestamp', 'User', 'Action', 'Module', 'Record Name', 'IP Address', 'Changes Summary'].join(','),
        ...filteredLogs.map(log => {
          const userName = getUserName(log.user_id);
          const recordName = getRecordName(log.resource_type, log.resource_id || '');
          const changesSummary = log.details?.field_changes 
            ? Object.entries(log.details.field_changes)
                .map(([field, change]: [string, any]) => 
                  `${formatFieldName(field)}: ${resolveValue(change.old, field)} → ${resolveValue(change.new, field)}`)
                .join('; ')
            : '';
          
          return [
            format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
            `"${userName}"`,
            getReadableAction(log.action),
            getReadableResourceType(log.resource_type),
            `"${recordName}"`,
            log.ip_address || '',
            `"${changesSummary.replace(/"/g, '""')}"`
          ].join(',');
        })
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-trail-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Audit trail exported successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export audit trail",
        variant: "destructive"
      });
    }
  };

  const canRevert = (log: AuditLog) => {
    return ['CREATE', 'UPDATE', 'DELETE'].includes(log.action) && 
           ['contacts', 'deals', 'leads', 'accounts', 'tasks', 'meetings'].includes(log.resource_type) && 
           log.resource_id && log.details;
  };

  const isValidTableName = (tableName: string): tableName is ValidTableName => {
    return ['contacts', 'deals', 'leads', 'accounts', 'tasks', 'meetings'].includes(tableName);
  };

  const handleRevertClick = (log: AuditLog) => {
    setSelectedLog(log);
    setRevertDialogOpen(true);
  };

  const handleViewDetails = (log: AuditLog) => {
    setDetailLog(log);
    setDetailModalOpen(true);
  };

  const revertAction = async () => {
    if (!selectedLog) return;
    setReverting(true);
    try {
      const { action, resource_type, resource_id, details } = selectedLog;

      if (!isValidTableName(resource_type)) {
        throw new Error(`Reverting ${resource_type} records is not supported`);
      }
      if (!resource_id) {
        throw new Error('Resource ID is required for revert operation');
      }

      if (action === 'DELETE' && details?.deleted_data) {
        const recordToRestore = { ...details.deleted_data };
        if (!recordToRestore.id) recordToRestore.id = resource_id;
        
        const { error } = await supabase.from(resource_type).insert([recordToRestore]);
        if (error) throw error;
        
        toast({
          title: "Success",
          description: `Deleted record has been restored`
        });
      } else if (action === 'UPDATE' && (details?.old_data || details?.field_changes)) {
        let oldData = details.old_data;
        
        if (!oldData && details.field_changes) {
          oldData = {};
          Object.entries(details.field_changes).forEach(([field, change]: [string, any]) => {
            if (change && typeof change === 'object' && 'old' in change) {
              oldData[field] = change.old;
            }
          });
        }
        
        if (Object.keys(oldData).length === 0) {
          throw new Error('No revertible data found');
        }
        
        const { error } = await supabase.from(resource_type).update(oldData).eq('id', resource_id);
        if (error) throw error;
        
        toast({
          title: "Success",
          description: `Record has been reverted to previous state`
        });
      } else if (action === 'CREATE') {
        const { error } = await supabase.from(resource_type).delete().eq('id', resource_id);
        if (error) throw error;
        
        toast({
          title: "Success",
          description: `Created record has been removed`
        });
      } else {
        throw new Error(`Cannot revert ${action} operation - insufficient data`);
      }

      await fetchAuditLogs();
    } catch (error: any) {
      console.error('Error reverting action:', error);
      toast({
        title: "Error",
        description: `Failed to revert: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setReverting(false);
      setRevertDialogOpen(false);
      setSelectedLog(null);
    }
  };

  const getSeverityBadge = (action: string, resourceType: string) => {
    // Critical actions
    if (['DELETE', 'BULK_DELETE', 'PASSWORD_RESET', 'ROLE_CHANGE', 'USER_DELETED'].includes(action)) {
      return <Badge variant="destructive" className="text-xs">Critical</Badge>;
    }
    // Warning actions
    if (['UPDATE', 'BULK_UPDATE', 'USER_DEACTIVATED', 'SETTINGS_UPDATE'].includes(action)) {
      return <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Warning</Badge>;
    }
    // Info actions
    return <Badge variant="outline" className="text-xs">Info</Badge>;
  };

  const getActionIcon = (action: string) => {
    if (action === 'CREATE' || action === 'BULK_CREATE') return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (action === 'UPDATE' || action === 'BULK_UPDATE' || action.includes('SETTINGS_')) return <Settings className="h-4 w-4 text-blue-600" />;
    if (action === 'DELETE' || action === 'BULK_DELETE') return <AlertTriangle className="h-4 w-4 text-red-600" />;
    if (action.includes('USER') || action.includes('ROLE')) return <UserCheck className="h-4 w-4 text-purple-600" />;
    if (action.includes('EXPORT') || action.includes('IMPORT')) return <Download className="h-4 w-4 text-teal-600" />;
    if (action.includes('SESSION') || action.includes('LOGIN') || action.includes('LOGOUT')) return <Shield className="h-4 w-4 text-gray-500" />;
    return <Activity className="h-4 w-4" />;
  };

  const getActionBadgeVariant = (action: string): "default" | "secondary" | "destructive" | "outline" => {
    if (action === 'CREATE' || action === 'BULK_CREATE') return 'default';
    if (action === 'UPDATE' || action === 'BULK_UPDATE') return 'secondary';
    if (action === 'DELETE' || action === 'BULK_DELETE') return 'destructive';
    if (action.includes('CREATED') || action.includes('ACTIVATED')) return 'default';
    if (action.includes('DELETED') || action.includes('DEACTIVATED')) return 'destructive';
    return 'outline';
  };

  const getReadableAction = (action: string) => {
    const actionMap: Record<string, string> = {
      'CREATE': 'Created Record',
      'UPDATE': 'Updated Record',
      'DELETE': 'Deleted Record',
      'BULK_CREATE': 'Bulk Created',
      'BULK_UPDATE': 'Bulk Updated',
      'BULK_DELETE': 'Bulk Deleted',
      'SESSION_START': 'User Login',
      'SESSION_END': 'User Logout',
      'SESSION_ACTIVE': 'Session Active',
      'SESSION_INACTIVE': 'Session Inactive',
      'SETTINGS_UPDATE': 'Settings Changed',
      'SETTINGS_CREATE': 'Settings Created',
      'PASSWORD_RESET': 'Password Reset',
      'ROLE_CHANGE': 'Role Changed',
      'DATA_EXPORT': 'Data Exported',
      'DATA_IMPORT': 'Data Imported',
    };
    return actionMap[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getReadableResourceType = (resourceType: string) => {
    const typeMap: Record<string, string> = {
      'contacts': 'Contacts',
      'leads': 'Leads',
      'deals': 'Deals',
      'accounts': 'Accounts',
      'tasks': 'Tasks',
      'meetings': 'Meetings',
      'auth': 'Authentication',
      'user_roles': 'User Roles',
      'profiles': 'User Profiles',
      'branding': 'Branding Settings',
      'branding_settings': 'Branding Settings',
      'announcements': 'Announcements',
      'email_templates': 'Email Templates',
      'notification_preferences': 'Notification Settings',
    };
    return typeMap[resourceType] || resourceType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Statistics calculations - now based on filteredLogs
  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const logsToday = filteredLogs.filter(l => new Date(l.created_at) >= today);
    
    return {
      total: filteredLogs.length,
      today: logsToday.length,
      creates: filteredLogs.filter(l => l.action === 'CREATE' || l.action === 'BULK_CREATE').length,
      updates: filteredLogs.filter(l => l.action === 'UPDATE' || l.action === 'BULK_UPDATE').length,
      deletes: filteredLogs.filter(l => l.action === 'DELETE' || l.action === 'BULK_DELETE').length,
      userManagement: filteredLogs.filter(l => l.action.includes('USER') || l.action.includes('ROLE')).length,
      settings: filteredLogs.filter(l => l.action.includes('SETTINGS_') || ['branding', 'announcements', 'email_templates'].includes(l.resource_type)).length,
    };
  }, [filteredLogs]);

  // Format user-friendly detail summary
  const getDetailSummary = (log: AuditLog) => {
    const details = log.details;
    if (!details) return null;

    const summaryItems: { label: string; value: string }[] = [];

    // Add record count for bulk operations
    if (details.count) {
      summaryItems.push({ label: 'Records Affected', value: String(details.count) });
    }

    // Add module info
    if (details.module) {
      summaryItems.push({ label: 'Module', value: details.module });
    }

    // Add record name if available
    if (details.record_name) {
      summaryItems.push({ label: 'Record Name', value: details.record_name });
    }

    // Add export/import info
    if (details.export_type) {
      summaryItems.push({ label: 'Export Type', value: details.export_type });
    }
    if (details.file_name) {
      summaryItems.push({ label: 'File Name', value: details.file_name });
    }

    // Add user management info
    if (details.target_user) {
      summaryItems.push({ label: 'Target User', value: resolvedNames.users[details.target_user] || details.target_user });
    }
    if (details.new_role) {
      summaryItems.push({ label: 'New Role', value: details.new_role });
    }
    if (details.old_role) {
      summaryItems.push({ label: 'Previous Role', value: details.old_role });
    }

    // Add session info
    if (details.browser) {
      summaryItems.push({ label: 'Browser', value: details.browser });
    }
    if (details.os) {
      summaryItems.push({ label: 'Operating System', value: details.os });
    }
    if (details.device) {
      summaryItems.push({ label: 'Device', value: details.device });
    }

    return summaryItems.length > 0 ? summaryItems : null;
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Activity & Audit Logs
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Track all user actions, data changes, and system events
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={fetchAuditLogs} variant="outline" size="sm">
                <Search className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={exportAuditTrail} size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input 
                placeholder="Search by user, record, action..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className="pl-9" 
              />
            </div>

            {/* Date Preset */}
            <Select value={datePreset} onValueChange={handleDatePresetChange}>
              <SelectTrigger className="w-[140px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                {DATE_PRESETS.map(preset => (
                  <SelectItem key={preset.days} value={String(preset.days)}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Action Filter */}
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Action Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="record_changes">Record Changes</SelectItem>
                <SelectItem value="user_management">User Management</SelectItem>
                <SelectItem value="authentication">Authentication</SelectItem>
                <SelectItem value="settings">Settings Changes</SelectItem>
                <SelectItem value="export">Import/Export</SelectItem>
              </SelectContent>
            </Select>

            {/* Resource Filter */}
            <Select value={resourceFilter} onValueChange={setResourceFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Module" />
              </SelectTrigger>
              <SelectContent>
                {RESOURCE_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Show Session Logs Toggle */}
            <div className="flex items-center gap-2 ml-auto">
              <Switch 
                id="show-sessions" 
                checked={showSessionLogs} 
                onCheckedChange={setShowSessionLogs}
              />
              <Label htmlFor="show-sessions" className="text-sm text-muted-foreground cursor-pointer">
                Show Session Activity
              </Label>
            </div>
          </div>

          {/* Results count and page size selector */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Showing {filteredLogs.length > 0 ? startIndex + 1 : 0}-{endIndex} of {filteredLogs.length} logs
              {logs.length !== filteredLogs.length && ` (filtered from ${logs.length} total)`}
            </span>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">Per page:</Label>
              <Select 
                value={String(pageSize)} 
                onValueChange={(v) => { 
                  setPageSize(Number(v)); 
                  setCurrentPage(1); 
                }}
              >
                <SelectTrigger className="w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Logs Table */}
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Module / Record</TableHead>
                    <TableHead>Changes</TableHead>
                    <TableHead className="w-[100px] text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLogs.map(log => {
                    const userName = getUserName(log.user_id);
                    const recordName = getRecordName(log.resource_type, log.resource_id || '');
                    const isAuthLog = log.action.includes('SESSION_') || log.action.includes('LOGIN') || log.action.includes('LOGOUT');
                    
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">
                          <div>{format(new Date(log.created_at), 'dd MMM yyyy')}</div>
                          <div className="text-muted-foreground">{format(new Date(log.created_at), 'HH:mm:ss')}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{userName}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={getActionBadgeVariant(log.action)} className="flex items-center gap-1">
                              {getActionIcon(log.action)}
                              <span className="text-xs">{getReadableAction(log.action)}</span>
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">
                            {log.details?.module || getReadableResourceType(log.resource_type)}
                          </div>
                          {recordName && (
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {recordName}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          {!isAuthLog && log.details?.field_changes && Object.keys(log.details.field_changes).length > 0 ? (
                            <div className="space-y-1">
                              {Object.entries(log.details.field_changes).slice(0, 2).map(([field, change]: [string, any]) => (
                                <div key={field} className="text-xs">
                                  <span className="font-medium">{formatFieldName(field)}:</span>
                                  <span className="text-muted-foreground"> {resolveValue(change.old, field)} → </span>
                                  <span className="text-primary">{resolveValue(change.new, field)}</span>
                                </div>
                              ))}
                              {Object.keys(log.details.field_changes).length > 2 && (
                                <span className="text-xs text-muted-foreground">
                                  +{Object.keys(log.details.field_changes).length - 2} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7"
                                  onClick={() => handleViewDetails(log)}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View Details</TooltipContent>
                            </Tooltip>
                            
                            {canRevert(log) && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7"
                                    onClick={() => handleRevertClick(log)}
                                    disabled={reverting}
                                  >
                                    <Undo className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Revert Changes</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {filteredLogs.length === 0 && (
                <div className="text-center py-8">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {searchTerm || actionFilter !== 'all' || resourceFilter !== 'all' 
                      ? 'No logs match your filters' 
                      : 'No audit logs found'}
                  </p>
                </div>
              )}
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between py-3 px-4 border-t">
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setCurrentPage(1)} 
                          disabled={currentPage === 1}
                        >
                          <ChevronsLeft className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>First Page</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Previous Page</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                          disabled={currentPage === totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Next Page</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setCurrentPage(totalPages)} 
                          disabled={currentPage === totalPages}
                        >
                          <ChevronsRight className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Last Page</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statistics Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5" />
            Log Statistics {filteredLogs.length !== logs.length && <span className="text-sm font-normal text-muted-foreground">(filtered view)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total Events</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.today}</div>
              <div className="text-xs text-muted-foreground">Today</div>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.creates}</div>
              <div className="text-xs text-muted-foreground">Creates</div>
            </div>
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.updates}</div>
              <div className="text-xs text-muted-foreground">Updates</div>
            </div>
            <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{stats.deletes}</div>
              <div className="text-xs text-muted-foreground">Deletes</div>
            </div>
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{stats.userManagement}</div>
              <div className="text-xs text-muted-foreground">User Mgmt</div>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{stats.settings}</div>
              <div className="text-xs text-muted-foreground">Settings</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Log Details
            </DialogTitle>
          </DialogHeader>
          {detailLog && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Timestamp</Label>
                    <p className="font-mono text-sm">{format(new Date(detailLog.created_at), 'dd MMM yyyy, HH:mm:ss')}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">User</Label>
                    <p className="font-medium">{getUserName(detailLog.user_id)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Action</Label>
                    <Badge variant={getActionBadgeVariant(detailLog.action)}>
                      {getReadableAction(detailLog.action)}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Module</Label>
                    <p>{getReadableResourceType(detailLog.resource_type)}</p>
                  </div>
                  {detailLog.resource_id && (
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground">Record</Label>
                      <p className="font-medium">
                        {getRecordName(detailLog.resource_type, detailLog.resource_id) || 'Record removed or not found'}
                      </p>
                    </div>
                  )}
                  {detailLog.ip_address && (
                    <div>
                      <Label className="text-xs text-muted-foreground">IP Address</Label>
                      <p className="font-mono text-sm">{detailLog.ip_address}</p>
                    </div>
                  )}
                </div>

                {/* User-friendly Detail Summary */}
                {getDetailSummary(detailLog) && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Additional Information</Label>
                    <div className="border rounded-lg p-3 space-y-2">
                      {getDetailSummary(detailLog)?.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{item.label}:</span>
                          <span className="font-medium">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Field Changes */}
                {detailLog.details?.field_changes && Object.keys(detailLog.details.field_changes).length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Changes</Label>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Field</TableHead>
                            <TableHead className="text-xs">Previous Value</TableHead>
                            <TableHead className="text-xs">New Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(detailLog.details.field_changes).map(([field, change]: [string, any]) => (
                            <TableRow key={field}>
                              <TableCell className="font-medium text-sm">{formatFieldName(field)}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {resolveValue(change.old, field)}
                              </TableCell>
                              <TableCell className="text-sm text-primary">
                                {resolveValue(change.new, field)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <RevertConfirmDialog 
        open={revertDialogOpen} 
        onConfirm={revertAction} 
        onCancel={() => {
          setRevertDialogOpen(false);
          setSelectedLog(null);
        }} 
      />
    </div>
  );
};

export default AuditLogsSettings;
