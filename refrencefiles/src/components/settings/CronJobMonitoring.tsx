import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { 
  Activity, 
  RefreshCw, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  Play,
  Calendar,
  Timer,
  Copy,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { format, formatDistanceToNow, differenceInHours } from 'date-fns';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface KeepAliveStatus {
  lastPing: string | null;
  status: 'active' | 'warning' | 'error' | 'unknown' | 'never_used';
  hoursAgo: number | null;
}

interface CronJobMonitoringProps {
  embedded?: boolean;
}

const SUPABASE_PROJECT_ID = 'narvjcteixgjclvjvlbn';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hcnZqY3RlaXhnamNsdmp2bGJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzMwODQsImV4cCI6MjA4MDc0OTA4NH0.M_-YQYDJqrEKguqwcJwM5mx2PSt1vFRZ0qytaxSlMMA';

// Auto-refresh interval in milliseconds (30 seconds)
const AUTO_REFRESH_INTERVAL = 30000;

const CronJobMonitoring = ({ embedded = false }: CronJobMonitoringProps) => {
  const [keepAlive, setKeepAlive] = useState<KeepAliveStatus>({
    lastPing: null,
    status: 'unknown',
    hoursAgo: null
  });
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const keepAliveEndpoint = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/keep-alive`;

  const fetchKeepAliveStatus = useCallback(async (showLoadingState = true) => {
    if (showLoadingState) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('keep_alive')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        // PGRST116 = no rows found
        if (error.code === 'PGRST116') {
          console.log('No keep-alive records found - table is empty');
          setKeepAlive({ lastPing: null, status: 'never_used', hoursAgo: null });
          return;
        }
        console.error('Error fetching keep-alive status:', error);
        setKeepAlive({ lastPing: null, status: 'error', hoursAgo: null });
        return;
      }

      if (data) {
        // Try 'Able to read DB' first, then fall back to created_at
        const lastPing = data['Able to read DB'] || data.created_at;
        
        if (lastPing) {
          const pingDate = new Date(lastPing);
          const hoursAgo = differenceInHours(new Date(), pingDate);
          
          let status: KeepAliveStatus['status'] = 'active';
          if (hoursAgo > 48) {
            status = 'error';
          } else if (hoursAgo > 25) {
            status = 'warning';
          }

          setKeepAlive({ lastPing, status, hoursAgo });
        } else {
          setKeepAlive({ lastPing: null, status: 'unknown', hoursAgo: null });
        }
      } else {
        setKeepAlive({ lastPing: null, status: 'never_used', hoursAgo: null });
      }
    } catch (error) {
      console.error('Error fetching keep-alive:', error);
      setKeepAlive({ lastPing: null, status: 'error', hoursAgo: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeepAliveStatus();
    
    // Set up auto-refresh
    intervalRef.current = setInterval(() => {
      fetchKeepAliveStatus(false); // Don't show loading state for auto-refresh
    }, AUTO_REFRESH_INTERVAL);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchKeepAliveStatus]);

  const handleTestKeepAlive = async () => {
    setTesting(true);
    try {
      const { error } = await supabase.functions.invoke('keep-alive', {
        method: 'POST'
      });

      if (error) {
        toast.error(`Keep-alive test failed: ${error.message}`);
      } else {
        toast.success('Keep-alive ping successful!');
        setTimeout(fetchKeepAliveStatus, 1000);
      }
    } catch (err: any) {
      toast.error(`Keep-alive test failed: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const getCurlCommand = () => {
    return `curl -X POST "${keepAliveEndpoint}" \\
  -H "Content-Type: application/json" \\
  -H "apikey: ${SUPABASE_ANON_KEY}"`;
  };

  const getStatusColor = (status: KeepAliveStatus['status']) => {
    switch (status) {
      case 'active': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'error': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status: KeepAliveStatus['status']) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning': return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'error': return <XCircle className="h-5 w-5 text-destructive" />;
      default: return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: KeepAliveStatus['status']) => {
    switch (status) {
      case 'active': return 'Active';
      case 'warning': return 'Warning';
      case 'error': return 'Inactive';
      case 'never_used': return 'Never Used';
      default: return 'Unknown';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header - only show when not embedded */}
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Cron Jobs & Keep-Alive</h3>
            <p className="text-sm text-muted-foreground">
              Monitor scheduled jobs and database connectivity
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchKeepAliveStatus()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      )}

      {/* Compact action row for embedded mode */}
      {embedded && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon(keepAlive.status)}
            <span className={`font-medium ${getStatusColor(keepAlive.status)}`}>
              {loading ? 'Checking...' : getStatusLabel(keepAlive.status)}
            </span>
            {keepAlive.lastPing && (
              <span className="text-xs text-muted-foreground">
                • {formatDistanceToNow(new Date(keepAlive.lastPing), { addSuffix: true })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleTestKeepAlive}
              disabled={testing}
            >
              {testing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Test Now
            </Button>
            <Button variant="outline" size="sm" onClick={() => fetchKeepAliveStatus()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className={`border-l-4 ${
          keepAlive.status === 'active' ? 'border-l-green-500' :
          keepAlive.status === 'warning' ? 'border-l-yellow-500' :
          keepAlive.status === 'error' ? 'border-l-destructive' :
          'border-l-muted-foreground'
        }`}>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Activity className="h-4 w-4" />
              Database Keep-Alive
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  getStatusIcon(keepAlive.status)
                )}
                <span className={`font-medium text-sm ${getStatusColor(keepAlive.status)}`}>
                  {loading ? 'Checking...' : getStatusLabel(keepAlive.status)}
                </span>
              </div>
              {!embedded && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleTestKeepAlive}
                  disabled={testing}
                  className="h-7 text-xs"
                >
                  {testing ? (
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3 mr-1" />
                  )}
                  Test
                </Button>
              )}
            </div>

            {keepAlive.lastPing && (
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Last Ping
                  </span>
                  <span className="font-medium text-foreground">
                    {formatDistanceToNow(new Date(keepAlive.lastPing), { addSuffix: true })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Timestamp
                  </span>
                  <span className="font-medium text-foreground">
                    {format(new Date(keepAlive.lastPing), 'MMM d, HH:mm')}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scheduler Setup Card */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Timer className="h-4 w-4" />
              Scheduler Setup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Endpoint</span>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-6 text-xs gap-1 px-2"
                  onClick={() => handleCopy(keepAliveEndpoint, 'Endpoint URL')}
                >
                  <Copy className="h-3 w-3" />
                  Copy URL
                </Button>
              </div>
              <code className="block text-[10px] bg-muted px-2 py-1.5 rounded overflow-x-auto">
                {keepAliveEndpoint}
              </code>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Required Header</span>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-6 text-xs gap-1 px-2"
                  onClick={() => handleCopy(`apikey: ${SUPABASE_ANON_KEY}`, 'Header')}
                >
                  <Copy className="h-3 w-3" />
                  Copy
                </Button>
              </div>
              <code className="block text-[10px] bg-muted px-2 py-1.5 rounded">
                apikey: {SUPABASE_ANON_KEY.slice(0, 20)}...
              </code>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button 
                size="sm" 
                variant="outline"
                className="flex-1 h-7 text-xs"
                onClick={() => handleCopy(getCurlCommand(), 'cURL command')}
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy cURL
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                className="h-7 text-xs"
                onClick={() => window.open('https://console.cron-job.org/', '_blank')}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                cron-job.org
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warning Alerts */}
      {keepAlive.status === 'warning' && (
        <Alert className="border-yellow-500/50 bg-yellow-500/5">
          <AlertCircle className="h-4 w-4 text-yellow-500" />
          <AlertTitle className="text-yellow-600 text-sm">Keep-Alive Warning</AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground">
            Last ping was over 25 hours ago. Click "Test Now" or check your cron job.
          </AlertDescription>
        </Alert>
      )}

      {keepAlive.status === 'error' && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle className="text-sm">Keep-Alive Inactive</AlertTitle>
          <AlertDescription className="text-xs">
            No ping in 48+ hours. Database may be sleeping. Click "Test Now" to wake it.
          </AlertDescription>
        </Alert>
      )}

      {/* How It Works - Collapsible */}
      <Collapsible open={howItWorksOpen} onOpenChange={setHowItWorksOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between h-9 px-3">
            <span className="text-xs font-medium">How It Works</span>
            {howItWorksOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="mt-2">
            <CardContent className="text-xs text-muted-foreground space-y-2 p-3">
              <p>
                <strong className="text-foreground">1. Cron Job:</strong> External scheduler (cron-job.org) 
                calls keep-alive daily.
              </p>
              <p>
                <strong className="text-foreground">2. Edge Function:</strong> Updates `keep_alive` table 
                with current timestamp.
              </p>
              <p>
                <strong className="text-foreground">3. Database:</strong> Activity prevents free-tier 
                Supabase from sleeping.
              </p>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default CronJobMonitoring;
