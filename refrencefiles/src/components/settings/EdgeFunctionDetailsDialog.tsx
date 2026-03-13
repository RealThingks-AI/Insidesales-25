import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  Copy, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Play, 
  RefreshCw,
  ExternalLink,
  Shield,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface EdgeFunction {
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

interface EdgeFunctionDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  func: EdgeFunction | null;
  onTestComplete?: () => void;
}

// Define safe functions that can be tested without side effects
const SAFE_TEST_FUNCTIONS: Record<string, { body?: object; description: string }> = {
  'keep-alive': { description: 'Pings database to verify connectivity' },
  'fetch-user-display-names': { body: { userIds: [] }, description: 'Fetches display names for user IDs' },
  'get-user-names': { body: { userIds: [] }, description: 'Gets user names by ID' },
  'security-monitor': { body: { test: true }, description: 'Logs a test security event' },
};

// Functions that should NOT be tested from the monitor
const UNSAFE_FUNCTIONS = [
  'send-email', 'create-backup', 'restore-backup', 
  'create-teams-meeting', 'update-teams-meeting', 'cancel-teams-meeting',
  'send-task-reminders', 'send-task-notification',
  'track-email-open', 'track-email-click', 'mark-email-bounced',
  'process-bounce-checks', 'process-email-replies',
  'sync-email-bounces', 'backfill-message-ids', 'sync-profile-names'
];

// Where each function is triggered in the UI
const FUNCTION_USAGE: Record<string, string> = {
  'keep-alive': 'Settings → System → Cron Jobs (Test Now button)',
  'create-backup': 'Settings → System → Data Backup (Create Backup button)',
  'restore-backup': 'Settings → System → Data Backup (Restore button)',
  'security-monitor': 'Automatic logging on security events',
  'user-admin': 'Settings → Users (CRUD operations)',
  'send-email': 'Email modals throughout the app',
  'process-bounce-checks': 'Scheduled cron job for bounce detection',
  'process-email-replies': 'Scheduled cron job for reply detection',
  'track-email-open': 'Tracking pixel in sent emails',
  'track-email-click': 'Link click tracking in sent emails',
  'mark-email-bounced': 'Called by bounce checker',
  'sync-email-bounces': 'Legacy - Not actively used',
  'backfill-message-ids': 'One-time migration - Not actively used',
  'send-task-reminders': 'Daily cron job for task reminders',
  'send-task-notification': 'Triggered on task assignment',
  'create-teams-meeting': 'Meetings → Create Meeting with Teams',
  'update-teams-meeting': 'Meetings → Edit Meeting',
  'cancel-teams-meeting': 'Meetings → Cancel Meeting',
  'fetch-user-display-names': 'Various tables showing user names',
  'get-user-names': 'Utility for resolving user IDs to names',
  'sync-profile-names': 'Profile synchronization',
};

const SUPABASE_PROJECT_ID = 'narvjcteixgjclvjvlbn';

const EdgeFunctionDetailsDialog = ({ open, onOpenChange, func, onTestComplete }: EdgeFunctionDetailsDialogProps) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const { user } = useAuth();

  if (!func) return null;

  const isSafe = SAFE_TEST_FUNCTIONS[func.name] !== undefined;
  const isDeprecated = func.status === 'deprecated';
  const endpoint = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/${func.name}`;
  
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const getCurlCommand = () => {
    const testConfig = SAFE_TEST_FUNCTIONS[func.name];
    const body = testConfig?.body ? JSON.stringify(testConfig.body) : '{}';
    return `curl -X POST "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "apikey: YOUR_ANON_KEY" \\
  -d '${body}'`;
  };

  const handleTest = async () => {
    if (!isSafe || isDeprecated) return;
    
    setTesting(true);
    setTestResult(null);
    
    try {
      const testConfig = SAFE_TEST_FUNCTIONS[func.name];
      let body = testConfig?.body || {};
      
      // Add current user ID for user-related functions
      if (func.name === 'fetch-user-display-names' || func.name === 'get-user-names') {
        if (user?.id) {
          body = { userIds: [user.id] };
        }
      }
      
      const { error } = await supabase.functions.invoke(func.name, {
        method: 'POST',
        body
      });

      if (error) {
        setTestResult('error');
        toast.error(`Test failed: ${error.message}`);
      } else {
        setTestResult('success');
        toast.success(`${func.displayName} is responding correctly`);
        onTestComplete?.();
      }
    } catch (err: any) {
      setTestResult('error');
      toast.error(`Test failed: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  const getStatusBadge = () => {
    switch (func.status) {
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

  const getCategoryBadge = () => {
    const colors: Record<string, string> = {
      system: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      email: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
      task: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
      meeting: 'bg-green-500/10 text-green-600 border-green-500/20',
      utility: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
    };
    return (
      <Badge className={colors[func.category] || colors.utility}>
        {func.category.charAt(0).toUpperCase() + func.category.slice(1)}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              func.status === 'active' ? 'bg-green-500/10' : 
              func.status === 'deprecated' ? 'bg-yellow-500/10' : 
              'bg-muted'
            }`}>
              {func.icon}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span>{func.displayName}</span>
                {getStatusBadge()}
              </div>
              <code className="text-xs font-normal text-muted-foreground">{func.name}</code>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Details for {func.displayName} edge function
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {getCategoryBadge()}
            <Badge variant={func.isRequired ? "default" : "secondary"}>
              {func.isRequired ? 'Required' : 'Optional'}
            </Badge>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground">{func.description}</p>

          <Separator />

          {/* Endpoint */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Endpoint</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md overflow-x-auto">
                {endpoint}
              </code>
              <Button 
                size="icon" 
                variant="outline" 
                className="h-8 w-8 shrink-0"
                onClick={() => handleCopy(endpoint, 'Endpoint')}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Where it's used */}
          <div className="space-y-2">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Info className="h-4 w-4" />
              Where it's triggered
            </p>
            <p className="text-sm text-muted-foreground">
              {FUNCTION_USAGE[func.name] || 'Called programmatically'}
            </p>
          </div>

          {/* Curl command for safe functions */}
          {isSafe && !isDeprecated && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Example cURL</p>
              <div className="relative">
                <pre className="text-xs bg-muted px-3 py-2 rounded-md overflow-x-auto whitespace-pre-wrap">
                  {getCurlCommand()}
                </pre>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-6 w-6 absolute top-1 right-1"
                  onClick={() => handleCopy(getCurlCommand(), 'cURL command')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          <Separator />

          {/* Test section */}
          <Card className={isDeprecated ? 'opacity-60' : ''}>
            <CardContent className="p-4">
              {isSafe && !isDeprecated ? (
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <Shield className="h-4 w-4 text-green-500" />
                      Safe to test
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {SAFE_TEST_FUNCTIONS[func.name]?.description}
                    </p>
                  </div>
                  <Button onClick={handleTest} disabled={testing} size="sm">
                    {testing ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : testResult === 'success' ? (
                      <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                    ) : testResult === 'error' ? (
                      <XCircle className="h-4 w-4 mr-2 text-destructive" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    {testing ? 'Testing...' : testResult === 'success' ? 'Passed' : testResult === 'error' ? 'Failed' : 'Run Test'}
                  </Button>
                </div>
              ) : isDeprecated ? (
                <div className="flex items-center gap-2 text-yellow-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">This function is deprecated and should not be tested.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Not safe to test from monitor</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This function requires specific parameters or may cause side effects. 
                    Trigger it via: <strong>{FUNCTION_USAGE[func.name] || 'its designated module'}</strong>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* View logs link */}
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => window.open(`https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/functions/${func.name}/logs`, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Logs in Supabase
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EdgeFunctionDetailsDialog;
