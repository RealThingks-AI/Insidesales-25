import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Monitor, Smartphone, Tablet, Clock, MapPin, Loader2, LogOut, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Session {
  id: string;
  ip_address: string | null;
  user_agent: string | null;
  device_info: {
    browser?: string;
    os?: string;
    device?: string;
  } | null;
  last_active_at: string;
  created_at: string;
  is_active: boolean;
}

const SessionManagementSettings = () => {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terminatingSession, setTerminatingSession] = useState<string | null>(null);
  const [showTerminateAllDialog, setShowTerminateAllDialog] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, [user]);

  const fetchSessions = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('last_active_at', { ascending: false });

      if (error) throw error;

      setSessions((data || []).map(s => ({
        ...s,
        ip_address: s.ip_address as string | null,
        device_info: s.device_info as Session['device_info']
      })));
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const terminateSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('id', sessionId);

      if (error) throw error;

      toast.success('Session terminated');
      fetchSessions();
    } catch (error) {
      console.error('Error terminating session:', error);
      toast.error('Failed to terminate session');
    } finally {
      setTerminatingSession(null);
    }
  };

  const terminateAllOtherSessions = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .neq('id', sessions[0]?.id || '');

      if (error) throw error;

      toast.success('All other sessions terminated');
      fetchSessions();
    } catch (error) {
      console.error('Error terminating sessions:', error);
      toast.error('Failed to terminate sessions');
    } finally {
      setShowTerminateAllDialog(false);
    }
  };

  const getDeviceIcon = (deviceInfo: Session['device_info']) => {
    const device = deviceInfo?.device?.toLowerCase() || '';
    if (device.includes('mobile') || device.includes('phone')) {
      return <Smartphone className="h-5 w-5" />;
    } else if (device.includes('tablet') || device.includes('ipad')) {
      return <Tablet className="h-5 w-5" />;
    }
    return <Monitor className="h-5 w-5" />;
  };

  const parseUserAgent = (userAgent: string | null): { browser: string; os: string } => {
    if (!userAgent) return { browser: 'Unknown', os: 'Unknown' };

    let browser = 'Unknown Browser';
    let os = 'Unknown OS';

    // Simple browser detection
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      browser = 'Chrome';
    } else if (userAgent.includes('Firefox')) {
      browser = 'Firefox';
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      browser = 'Safari';
    } else if (userAgent.includes('Edg')) {
      browser = 'Edge';
    }

    // Simple OS detection
    if (userAgent.includes('Windows')) {
      os = 'Windows';
    } else if (userAgent.includes('Mac')) {
      os = 'macOS';
    } else if (userAgent.includes('Linux')) {
      os = 'Linux';
    } else if (userAgent.includes('Android')) {
      os = 'Android';
    } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      os = 'iOS';
    }

    return { browser, os };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Active Sessions
              </CardTitle>
              <CardDescription>
                Manage your active login sessions across devices
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchSessions}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              {sessions.length > 1 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowTerminateAllDialog(true)}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out All Others
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No active sessions found
            </p>
          ) : (
            <div className="space-y-4">
              {sessions.map((session, index) => {
                const { browser, os } = parseUserAgent(session.user_agent);
                const isCurrentSession = index === 0;

                return (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-muted rounded-lg">
                        {getDeviceIcon(session.device_info)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{browser} on {os}</span>
                          {isCurrentSession && (
                            <Badge variant="secondary">Current</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          {session.ip_address && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {session.ip_address}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Last active: {format(new Date(session.last_active_at), 'dd/MM, HH:mm')}
                          </span>
                        </div>
                      </div>
                    </div>
                    {!isCurrentSession && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setTerminatingSession(session.id)}
                      >
                        <LogOut className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Single Session Terminate Dialog */}
      <AlertDialog
        open={!!terminatingSession}
        onOpenChange={() => setTerminatingSession(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminate Session</AlertDialogTitle>
            <AlertDialogDescription>
              This will sign out this device. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => terminatingSession && terminateSession(terminatingSession)}
            >
              Terminate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Terminate All Dialog */}
      <AlertDialog open={showTerminateAllDialog} onOpenChange={setShowTerminateAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign Out All Other Sessions</AlertDialogTitle>
            <AlertDialogDescription>
              This will sign out all devices except the current one. You'll need to log in again on those devices.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={terminateAllOtherSessions}>
              Sign Out All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SessionManagementSettings;