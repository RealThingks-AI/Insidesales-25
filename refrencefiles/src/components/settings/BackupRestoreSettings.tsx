import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { 
  Database, 
  Download, 
  Upload, 
  Trash2, 
  RefreshCw, 
  ShieldAlert,
  Clock,
  User,
  HardDrive,
  FileJson,
  CalendarClock,
  Copy,
  ExternalLink
} from "lucide-react";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import SettingsLoadingSkeleton from './shared/SettingsLoadingSkeleton';

// Lazy load ModuleImportExport
const ModuleImportExport = lazy(() => import('./ModuleImportExport'));

interface Backup {
  id: string;
  file_name: string;
  file_path: string;
  size_bytes: number;
  tables_count: number;
  records_count: number;
  backup_type: string;
  status: string;
  manifest: any;
  created_at: string;
  created_by: string;
}

interface BackupSchedule {
  id?: string;
  frequency: string;
  time_of_day: string;
  is_enabled: boolean;
  next_run_at?: string;
  last_run_at?: string;
}

const BackupRestoreSettings = () => {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [schedule, setSchedule] = useState<BackupSchedule>({
    frequency: 'daily',
    time_of_day: '00:00',
    is_enabled: false,
  });
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { user } = useAuth();

  const fetchBackups = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('backups')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setBackups(data || []);

      // Fetch user names for creators
      const userIds = [...new Set((data || []).map(b => b.created_by).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        
        if (profiles) {
          const names: Record<string, string> = {};
          profiles.forEach(p => {
            names[p.id] = p.full_name || 'Unknown';
          });
          setUserNames(names);
        }
      }
    } catch (error: any) {
      console.error('Error fetching backups:', error);
      toast.error('Failed to fetch backups');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSchedule = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('backup_schedules')
        .select('*')
        .limit(1)
        .single();

      if (data && !error) {
        setSchedule({
          id: data.id,
          frequency: data.frequency || 'daily',
          time_of_day: data.time_of_day || '00:00',
          is_enabled: data.is_enabled || false,
          next_run_at: data.next_run_at,
          last_run_at: data.last_run_at,
        });
      }
    } catch (error) {
      // No schedule exists yet, use defaults
      console.log('No backup schedule found, using defaults');
    }
  }, []);

  const handleSaveSchedule = async (newSchedule: BackupSchedule) => {
    setSavingSchedule(true);
    try {
      const scheduleData = {
        frequency: newSchedule.frequency,
        time_of_day: newSchedule.time_of_day,
        is_enabled: newSchedule.is_enabled,
        created_by: user?.id,
      };

      if (schedule.id) {
        // Update existing
        const { error } = await supabase
          .from('backup_schedules')
          .update(scheduleData)
          .eq('id', schedule.id);
        
        if (error) throw error;
      } else {
        // Create new
        const { data, error } = await supabase
          .from('backup_schedules')
          .insert(scheduleData)
          .select()
          .single();
        
        if (error) throw error;
        if (data) {
          setSchedule(prev => ({ ...prev, id: data.id }));
        }
      }
      
      toast.success(newSchedule.is_enabled ? 'Scheduled backup enabled' : 'Scheduled backup disabled');
    } catch (error: any) {
      console.error('Error saving schedule:', error);
      toast.error('Failed to save backup schedule');
    } finally {
      setSavingSchedule(false);
    }
  };

  useEffect(() => {
    if (!roleLoading && isAdmin) {
      fetchBackups();
      fetchSchedule();
    } else if (!roleLoading) {
      setLoading(false);
    }
  }, [fetchBackups, fetchSchedule, isAdmin, roleLoading]);

  const handleCreateBackup = async () => {
    if (!isAdmin) {
      toast.error('Only admins can create backups');
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-backup', {
        method: 'POST',
        body: { includeAuditLogs: true }
      });

      if (error) throw error;

      toast.success('Backup created successfully');
      
      await fetchBackups();
    } catch (error: any) {
      console.error('Error creating backup:', error);
      toast.error(error.message || 'Failed to create backup');
    } finally {
      setCreating(false);
    }
  };

  const handleDownloadBackup = async (backup: Backup) => {
    try {
      const { data, error } = await supabase.storage
        .from('backups')
        .download(backup.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = backup.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Backup download started');
    } catch (error: any) {
      console.error('Error downloading backup:', error);
      toast.error('Failed to download backup');
    }
  };

  const handleRestoreClick = (backup: Backup) => {
    setSelectedBackup(backup);
    setConfirmText('');
    setShowRestoreDialog(true);
  };

  const handleRestoreConfirm = async () => {
    if (!selectedBackup || confirmText !== 'CONFIRM') return;

    setRestoring(selectedBackup.id);
    setShowRestoreDialog(false);

    try {
      const { data, error } = await supabase.functions.invoke('restore-backup', {
        method: 'POST',
        body: { backupId: selectedBackup.id }
      });

      if (error) throw error;

      toast.success('Restore process initiated. This may take a few minutes.');
    } catch (error: any) {
      console.error('Error restoring backup:', error);
      toast.error(error.message || 'Failed to restore backup');
    } finally {
      setRestoring(null);
      setSelectedBackup(null);
    }
  };

  const handleDeleteClick = (backup: Backup) => {
    setSelectedBackup(backup);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedBackup) return;

    setDeleting(selectedBackup.id);
    setShowDeleteDialog(false);

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('backups')
        .remove([selectedBackup.file_path]);

      if (storageError) throw storageError;

      // Delete metadata
      const { error: dbError } = await supabase
        .from('backups')
        .delete()
        .eq('id', selectedBackup.id);

      if (dbError) throw dbError;

      toast.success('Backup deleted successfully');

      await fetchBackups();
    } catch (error: any) {
      console.error('Error deleting backup:', error);
      toast.error('Failed to delete backup');
    } finally {
      setDeleting(null);
      setSelectedBackup(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (roleLoading || loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Backup & Restore
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
            <Database className="h-5 w-5" />
            Backup & Restore
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Access Denied</h3>
            <p className="text-muted-foreground">Only administrators can manage backups.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Export/Import Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5" />
                Export Data
              </CardTitle>
              <CardDescription>
                Create a complete backup and save to secure storage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full" 
                onClick={handleCreateBackup}
                disabled={creating}
              >
                {creating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Creating Backup...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export All Data
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Upload className="h-5 w-5" />
                Import Data
              </CardTitle>
              <CardDescription>
                Completely replace database from a backup file
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-full">
                      <Button variant="outline" className="w-full" disabled>
                        <Upload className="h-4 w-4 mr-2" />
                        Import Backup File
                      </Button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Use the restore option from backup history below</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Restore from backup history below
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Scheduled Backup Toggle */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-5 w-5 text-muted-foreground" />
                  <Label htmlFor="scheduled-backup" className="text-base">Scheduled Backups</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Automatically create daily backups at scheduled time
                </p>
              </div>
              <Switch
                id="scheduled-backup"
                checked={schedule.is_enabled}
                onCheckedChange={(checked) => {
                  setSchedule(prev => ({ ...prev, is_enabled: checked }));
                  handleSaveSchedule({ ...schedule, is_enabled: checked });
                }}
              />
            </div>
            {schedule.is_enabled && (
              <div className="mt-4 pt-4 border-t space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm text-muted-foreground">Time:</Label>
                    <Select
                      value={schedule.time_of_day}
                      onValueChange={(value) => {
                        setSchedule(prev => ({ ...prev, time_of_day: value }));
                        handleSaveSchedule({ ...schedule, time_of_day: value });
                      }}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="00:00">12:00 AM</SelectItem>
                        <SelectItem value="06:00">6:00 AM</SelectItem>
                        <SelectItem value="12:00">12:00 PM</SelectItem>
                        <SelectItem value="18:00">6:00 PM</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {savingSchedule && (
                    <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                
                {/* Schedule Info */}
                <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-muted/50">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Next Run
                    </p>
                    <p className="text-sm font-medium">
                      {schedule.next_run_at 
                        ? format(new Date(schedule.next_run_at), 'MMM d, yyyy HH:mm')
                        : 'Pending...'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Last Run
                    </p>
                    <p className="text-sm font-medium">
                      {schedule.last_run_at 
                        ? format(new Date(schedule.last_run_at), 'MMM d, yyyy HH:mm')
                        : 'Never'}
                    </p>
                  </div>
                </div>

                {/* Setup Instructions Alert */}
                <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                  <p className="text-sm font-medium text-amber-600 mb-2">⚠️ External Scheduler Required</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    For scheduled backups to run automatically, you need to set up an external cron service 
                    (like cron-job.org) to call the backup endpoint at your scheduled time.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                      onClick={() => {
                        const endpoint = `https://narvjcteixgjclvjvlbn.supabase.co/functions/v1/run-scheduled-backup`;
                        navigator.clipboard.writeText(endpoint);
                        toast.success('Endpoint URL copied to clipboard');
                      }}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy Endpoint
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                      onClick={() => window.open('https://console.cron-job.org/', '_blank')}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      cron-job.org
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Module Import/Export */}
        <Suspense fallback={<SettingsLoadingSkeleton />}>
          <ModuleImportExport />
        </Suspense>

        {/* Backup History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Backup History
            </CardTitle>
            <CardDescription>
              Recent backups with download and restore options (last 10)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {backups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No backups found</p>
                <p className="text-sm">Create your first backup to get started</p>
              </div>
            ) : (
              backups.map((backup) => (
                <div 
                  key={backup.id} 
                  className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <FileJson className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{backup.file_name}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(backup.created_at), 'dd/MM/yyyy, HH:mm:ss')}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {backup.backup_type === 'scheduled' ? 'Scheduled' : 'Manual'}
                      </span>
                      <span>
                        {backup.tables_count} tables • {backup.records_count?.toLocaleString()} records
                      </span>
                      <span className="flex items-center gap-1">
                        <HardDrive className="h-3 w-3" />
                        {formatBytes(backup.size_bytes)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDownloadBackup(backup)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="sm"
                      onClick={() => handleRestoreClick(backup)}
                      disabled={restoring === backup.id}
                    >
                      {restoring === backup.id ? (
                        <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Database className="h-4 w-4 mr-1" />
                      )}
                      Restore
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDeleteClick(backup)}
                      disabled={deleting === backup.id}
                      className="text-destructive hover:text-destructive"
                    >
                      {deleting === backup.id ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">⚠️ Confirm Restore</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>You are about to restore the database from backup:</p>
              <p className="font-mono text-sm bg-muted p-2 rounded">{selectedBackup?.file_name}</p>
              <div className="bg-destructive/10 border border-destructive/20 rounded p-3 text-sm">
                <p className="font-semibold text-destructive">This action will:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Overwrite all current database tables</li>
                  <li>Replace all storage files</li>
                  <li>May cause brief downtime</li>
                  <li>Cannot be undone</li>
                </ul>
              </div>
              <div className="space-y-2">
                <Label>Type "CONFIRM" to proceed:</Label>
                <Input 
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="CONFIRM"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRestoreConfirm}
              disabled={confirmText !== 'CONFIRM'}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Restore Backup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Backup</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this backup? This action cannot be undone.
              <p className="font-mono text-sm bg-muted p-2 rounded mt-2">{selectedBackup?.file_name}</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BackupRestoreSettings;
