import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { 
  Activity, 
  RefreshCw, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  Clock,
  Mail,
  Bell,
  Database,
  Shield,
  Calendar,
  Users,
  Play,
  Zap,
  AlertTriangle
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EdgeFunctionDetailsDialog from './EdgeFunctionDetailsDialog';

interface EdgeFunctionStatus {
  name: string;
  displayName: string;
  category: 'email' | 'task' | 'meeting' | 'system' | 'utility';
  status: 'active' | 'error' | 'unknown' | 'deprecated' | 'never_used';
  lastActivity?: string;
  activityCount?: number;
  description: string;
  icon: React.ReactNode;
  isRequired: boolean;
}

interface EdgeFunctionMonitorProps {
  embedded?: boolean;
}

// Safe functions that can be tested
const SAFE_FUNCTIONS = ['keep-alive', 'fetch-user-display-names', 'get-user-names', 'security-monitor'];

const EdgeFunctionMonitor = ({ embedded = false }: EdgeFunctionMonitorProps) => {
  const [functions, setFunctions] = useState<EdgeFunctionStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [showDeprecated, setShowDeprecated] = useState(false);
  const [selectedFunction, setSelectedFunction] = useState<EdgeFunctionStatus | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const fetchFunctionStatuses = useCallback(async () => {
    setLoading(true);
    try {
      const [
        keepAliveResult,
        emailHistoryResult,
        bouncesResult,
        repliesResult,
        backupsResult,
        securityLogsResult,
        tasksResult,
        meetingsResult,
        profilesResult,
      ] = await Promise.all([
        supabase.from('keep_alive').select('*').order('created_at', { ascending: false }).limit(1),
        supabase.from('email_history').select('id, sent_at', { count: 'exact', head: false }).order('sent_at', { ascending: false }).limit(1),
        supabase.from('email_history').select('id, bounced_at').not('bounced_at', 'is', null).order('bounced_at', { ascending: false }).limit(1),
        supabase.from('email_replies').select('id, received_at', { count: 'exact', head: false }).order('received_at', { ascending: false }).limit(1),
        supabase.from('backups').select('id, created_at').order('created_at', { ascending: false }).limit(1),
        supabase.from('security_audit_log').select('id, created_at', { count: 'exact', head: false }).order('created_at', { ascending: false }).limit(1),
        supabase.from('tasks').select('id, created_at').order('created_at', { ascending: false }).limit(1),
        supabase.from('meetings').select('id, created_at').order('created_at', { ascending: false }).limit(1),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
      ]);

      const getStatus = (data: any, field: string = 'created_at'): { status: 'active' | 'unknown' | 'never_used', lastActivity?: string } => {
        if (!data?.data || data.data.length === 0) {
          return { status: 'never_used' };
        }
        if (data?.data?.[0]) {
          const activityDate = data.data[0][field];
          if (activityDate) {
            const date = new Date(activityDate);
            const hoursAgo = (Date.now() - date.getTime()) / (1000 * 60 * 60);
            return {
              status: hoursAgo < 168 ? 'active' : 'unknown',
              lastActivity: activityDate
            };
          }
        }
        return { status: 'unknown' };
      };

      // Get keep-alive status - use 'Able to read DB' or fallback to 'created_at'
      let keepAliveStatus: { status: 'active' | 'unknown' | 'never_used', lastActivity?: string } = { status: 'never_used' };
      if (keepAliveResult?.data?.[0]) {
        const record = keepAliveResult.data[0];
        const lastPing = record['Able to read DB'] || record.created_at;
        if (lastPing) {
          const date = new Date(lastPing);
          const hoursAgo = (Date.now() - date.getTime()) / (1000 * 60 * 60);
          keepAliveStatus = {
            status: hoursAgo < 48 ? 'active' : 'unknown',
            lastActivity: lastPing
          };
        }
      }

      const emailStatus = getStatus(emailHistoryResult, 'sent_at');
      const bounceStatus = getStatus(bouncesResult, 'bounced_at');
      const replyStatus = getStatus(repliesResult, 'received_at');
      const backupStatus = getStatus(backupsResult);
      const securityStatus = getStatus(securityLogsResult);

      const functionsList: EdgeFunctionStatus[] = [
        // System Functions
        {
          name: 'keep-alive',
          displayName: 'Keep Alive',
          category: 'system',
          status: keepAliveStatus.status,
          lastActivity: keepAliveStatus.lastActivity,
          description: 'Keeps database active with periodic pings',
          icon: <Activity className="h-4 w-4" />,
          isRequired: true
        },
        {
          name: 'create-backup',
          displayName: 'Create Backup',
          category: 'system',
          status: backupStatus.status,
          lastActivity: backupStatus.lastActivity,
          description: 'Creates database backups with auto-cleanup',
          icon: <Database className="h-4 w-4" />,
          isRequired: true
        },
        {
          name: 'restore-backup',
          displayName: 'Restore Backup',
          category: 'system',
          status: 'unknown',
          description: 'Restores database from backup file',
          icon: <Database className="h-4 w-4" />,
          isRequired: true
        },
        {
          name: 'security-monitor',
          displayName: 'Security Monitor',
          category: 'system',
          status: securityStatus.status,
          lastActivity: securityStatus.lastActivity,
          description: 'Logs security events and anomalies',
          icon: <Shield className="h-4 w-4" />,
          isRequired: true
        },
        {
          name: 'user-admin',
          displayName: 'User Admin',
          category: 'system',
          status: profilesResult?.count ? 'active' : 'unknown',
          activityCount: profilesResult?.count || 0,
          description: 'User CRUD operations with retry logic',
          icon: <Users className="h-4 w-4" />,
          isRequired: true
        },

        // Email Functions
        {
          name: 'send-email',
          displayName: 'Send Email',
          category: 'email',
          status: emailStatus.status,
          lastActivity: emailStatus.lastActivity,
          description: 'Sends emails via Outlook with tracking',
          icon: <Mail className="h-4 w-4" />,
          isRequired: true
        },
        {
          name: 'process-bounce-checks',
          displayName: 'Bounce Checker',
          category: 'email',
          status: bounceStatus.status,
          lastActivity: bounceStatus.lastActivity,
          description: 'Detects bounced emails from NDR',
          icon: <AlertTriangle className="h-4 w-4" />,
          isRequired: true
        },
        {
          name: 'process-email-replies',
          displayName: 'Reply Detector',
          category: 'email',
          status: replyStatus.status,
          lastActivity: replyStatus.lastActivity,
          description: 'Detects and logs email replies',
          icon: <Mail className="h-4 w-4" />,
          isRequired: true
        },
        {
          name: 'track-email-open',
          displayName: 'Open Tracker',
          category: 'email',
          status: emailStatus.status,
          description: 'Tracks email open events',
          icon: <Mail className="h-4 w-4" />,
          isRequired: true
        },
        {
          name: 'track-email-click',
          displayName: 'Click Tracker',
          category: 'email',
          status: emailStatus.status,
          description: 'Tracks email link clicks',
          icon: <Mail className="h-4 w-4" />,
          isRequired: true
        },
        {
          name: 'mark-email-bounced',
          displayName: 'Mark Bounced',
          category: 'email',
          status: bounceStatus.status,
          description: 'Marks emails as bounced',
          icon: <XCircle className="h-4 w-4" />,
          isRequired: true
        },
        {
          name: 'sync-email-bounces',
          displayName: 'Sync Bounces',
          category: 'email',
          status: 'deprecated',
          description: 'Legacy bounce sync (not actively used)',
          icon: <RefreshCw className="h-4 w-4" />,
          isRequired: false
        },
        {
          name: 'backfill-message-ids',
          displayName: 'Backfill IDs',
          category: 'email',
          status: 'deprecated',
          description: 'One-time migration for message IDs',
          icon: <Database className="h-4 w-4" />,
          isRequired: false
        },

        // Task Functions
        {
          name: 'send-task-reminders',
          displayName: 'Task Reminders',
          category: 'task',
          status: tasksResult?.data?.length ? 'active' : 'unknown',
          lastActivity: tasksResult?.data?.[0]?.created_at,
          description: 'Sends daily task reminder emails',
          icon: <Bell className="h-4 w-4" />,
          isRequired: true
        },
        {
          name: 'send-task-notification',
          displayName: 'Task Notifications',
          category: 'task',
          status: tasksResult?.data?.length ? 'active' : 'unknown',
          description: 'Sends task assignment notifications',
          icon: <Bell className="h-4 w-4" />,
          isRequired: true
        },

        // Meeting Functions
        {
          name: 'create-teams-meeting',
          displayName: 'Create Meeting',
          category: 'meeting',
          status: meetingsResult?.data?.length ? 'active' : 'unknown',
          lastActivity: meetingsResult?.data?.[0]?.created_at,
          description: 'Creates MS Teams meetings',
          icon: <Calendar className="h-4 w-4" />,
          isRequired: true
        },
        {
          name: 'update-teams-meeting',
          displayName: 'Update Meeting',
          category: 'meeting',
          status: 'unknown',
          description: 'Updates MS Teams meetings',
          icon: <Calendar className="h-4 w-4" />,
          isRequired: true
        },
        {
          name: 'cancel-teams-meeting',
          displayName: 'Cancel Meeting',
          category: 'meeting',
          status: 'unknown',
          description: 'Cancels MS Teams meetings',
          icon: <Calendar className="h-4 w-4" />,
          isRequired: true
        },

        // Utility Functions
        {
          name: 'fetch-user-display-names',
          displayName: 'Fetch Names',
          category: 'utility',
          status: 'active',
          description: 'Gets user display names',
          icon: <Users className="h-4 w-4" />,
          isRequired: true
        },
        {
          name: 'get-user-names',
          displayName: 'Get Names',
          category: 'utility',
          status: 'active',
          description: 'Utility for user names',
          icon: <Users className="h-4 w-4" />,
          isRequired: true
        },
        {
          name: 'sync-profile-names',
          displayName: 'Sync Profiles',
          category: 'utility',
          status: profilesResult?.count ? 'active' : 'unknown',
          activityCount: profilesResult?.count || 0,
          description: 'Syncs profile display names',
          icon: <RefreshCw className="h-4 w-4" />,
          isRequired: true
        },
      ];

      setFunctions(functionsList);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching function statuses:', error);
      toast.error('Failed to fetch edge function statuses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFunctionStatuses();
  }, [fetchFunctionStatuses]);

  const handleTestFunction = async (e: React.MouseEvent, functionName: string) => {
    e.stopPropagation();
    
    if (!SAFE_FUNCTIONS.includes(functionName)) {
      toast.error('This function cannot be tested from the monitor');
      return;
    }
    
    setTesting(functionName);
    try {
      const { error } = await supabase.functions.invoke(functionName, {
        method: 'POST',
        body: {}
      });

      if (error) {
        toast.error(`${functionName} test failed: ${error.message}`);
      } else {
        toast.success(`${functionName} is responding correctly`);
      }
    } catch (err: any) {
      toast.error(`${functionName} test failed: ${err.message}`);
    } finally {
      setTesting(null);
      setTimeout(fetchFunctionStatuses, 1000);
    }
  };

  const handleCardClick = (func: EdgeFunctionStatus) => {
    setSelectedFunction(func);
    setDetailsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent, func: EdgeFunctionStatus) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick(func);
    }
  };

  const getStatusBadge = (status: EdgeFunctionStatus['status']) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Active</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'deprecated':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Deprecated</Badge>;
      case 'never_used':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Never Used</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const categories = [
    { id: 'all', label: 'All', icon: Zap },
    { id: 'system', label: 'System', icon: Database },
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'task', label: 'Tasks', icon: Bell },
    { id: 'meeting', label: 'Meetings', icon: Calendar },
    { id: 'utility', label: 'Utility', icon: Users },
  ];

  const getFunctionsByCategory = (category: string) => {
    let filtered = category === 'all' ? functions : functions.filter(f => f.category === category);
    if (!showDeprecated) {
      filtered = filtered.filter(f => f.status !== 'deprecated');
    }
    return filtered;
  };

  const activeCount = functions.filter(f => f.status === 'active').length;
  const deprecatedCount = functions.filter(f => f.status === 'deprecated').length;
  const unknownCount = functions.filter(f => f.status === 'unknown').length;
  const visibleCount = showDeprecated ? functions.length : functions.filter(f => f.status !== 'deprecated').length;

  return (
    <div className="space-y-4">
      {/* Header - only show when not embedded */}
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Edge Functions</h3>
            <p className="text-sm text-muted-foreground">
              Monitor and test all {visibleCount} edge functions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Last: {format(lastRefresh, 'HH:mm:ss')}
            </span>
            <Button variant="outline" size="sm" onClick={fetchFunctionStatuses} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      )}

      {/* Compact action row for embedded mode */}
      {embedded && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">{activeCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{unknownCount}</span>
            </div>
            {deprecatedCount > 0 && (
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">{deprecatedCount}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch 
                id="show-deprecated" 
                checked={showDeprecated} 
                onCheckedChange={setShowDeprecated}
              />
              <Label htmlFor="show-deprecated" className="text-xs">Show deprecated</Label>
            </div>
            <span className="text-xs text-muted-foreground">
              {format(lastRefresh, 'HH:mm')}
            </span>
            <Button variant="outline" size="sm" onClick={fetchFunctionStatuses} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      )}

      {/* Stats Overview - more compact */}
      {!embedded && (
        <div className="grid grid-cols-4 gap-3">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-xl font-bold">{visibleCount}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground">Active</p>
              <p className="text-xl font-bold text-green-600">{activeCount}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-yellow-500">
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground">Deprecated</p>
              <p className="text-xl font-bold text-yellow-600">{deprecatedCount}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-muted-foreground">
            <CardContent className="py-3 px-4">
              <p className="text-xs text-muted-foreground">Unknown</p>
              <p className="text-xl font-bold text-muted-foreground">{unknownCount}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Show deprecated toggle for non-embedded */}
      {!embedded && deprecatedCount > 0 && (
        <div className="flex items-center gap-2">
          <Switch 
            id="show-deprecated-main" 
            checked={showDeprecated} 
            onCheckedChange={setShowDeprecated}
          />
          <Label htmlFor="show-deprecated-main" className="text-sm">Show deprecated functions</Label>
        </div>
      )}

      {/* Functions by Category */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          {categories.map(cat => {
            const Icon = cat.icon;
            const count = getFunctionsByCategory(cat.id).length;
            return (
              <TabsTrigger key={cat.id} value={cat.id} className="flex items-center gap-1">
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-xs">{cat.label}</span>
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{count}</Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {categories.map(cat => (
          <TabsContent key={cat.id} value={cat.id} className="mt-3">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {getFunctionsByCategory(cat.id).map((func) => (
                  <Card 
                    key={func.name} 
                    className={`transition-all cursor-pointer hover:shadow-md hover:border-primary/50 ${func.status === 'deprecated' ? 'opacity-60' : ''}`}
                    onClick={() => handleCardClick(func)}
                    onKeyDown={(e) => handleKeyDown(e, func)}
                    role="button"
                    tabIndex={0}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2.5">
                          <div className={`p-1.5 rounded-md ${
                            func.status === 'active' ? 'bg-green-500/10' : 
                            func.status === 'deprecated' ? 'bg-yellow-500/10' : 
                            'bg-muted'
                          }`}>
                            {func.icon}
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{func.displayName}</span>
                              {getStatusBadge(func.status)}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-1">{func.description}</p>
                            {func.lastActivity && (
                              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                {formatDistanceToNow(new Date(func.lastActivity), { addSuffix: true })}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {SAFE_FUNCTIONS.includes(func.name) && func.status !== 'deprecated' && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={(e) => handleTestFunction(e, func.name)}
                                    disabled={testing === func.name}
                                  >
                                    {testing === func.name ? (
                                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Play className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Test function</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Details Dialog */}
      <EdgeFunctionDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        func={selectedFunction}
        onTestComplete={fetchFunctionStatuses}
      />
    </div>
  );
};

export default EdgeFunctionMonitor;
