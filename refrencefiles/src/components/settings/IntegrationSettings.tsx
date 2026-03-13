import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useUserRole } from '@/hooks/useUserRole';
import { 
  Loader2, 
  Video, 
  Mail, 
  Calendar, 
  CheckCircle2, 
  XCircle,
  ExternalLink,
  Settings,
  X
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Integration {
  id: string;
  integration_name: string;
  is_enabled: boolean;
  config: Record<string, any> | null;
  last_sync_at: string | null;
  sync_status: string;
}

const IntegrationSettings = () => {
  const { userRole } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [configData, setConfigData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      const { data, error } = await supabase
        .from('integration_settings')
        .select('*')
        .order('integration_name');

      if (error) throw error;

      setIntegrations((data || []).map(i => ({
        ...i,
        config: i.config as Record<string, any> | null
      })));
    } catch (error) {
      console.error('Error fetching integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleIntegration = async (id: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('integration_settings')
        .update({ is_enabled: enabled })
        .eq('id', id);

      if (error) throw error;

      setIntegrations(prev => 
        prev.map(i => i.id === id ? { ...i, is_enabled: enabled } : i)
      );

      toast.success(`Integration ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error updating integration:', error);
      toast.error('Failed to update integration');
    }
  };

  const handleConfigureClick = (integration: Integration) => {
    setSelectedIntegration(integration);
    setConfigData(integration.config || {});
    setShowConfigModal(true);
  };

  const handleSaveConfig = async () => {
    if (!selectedIntegration) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('integration_settings')
        .update({ 
          config: configData,
          sync_status: 'active'
        })
        .eq('id', selectedIntegration.id);

      if (error) throw error;

      setIntegrations(prev => 
        prev.map(i => i.id === selectedIntegration.id 
          ? { ...i, config: configData, sync_status: 'active' } 
          : i
        )
      );

      toast.success('Configuration saved successfully');
      setShowConfigModal(false);
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const getConfigFields = (integrationName: string): { key: string; label: string; type: string }[] => {
    switch (integrationName.toLowerCase()) {
      case 'microsoft teams':
        return [
          { key: 'client_id', label: 'Client ID', type: 'text' },
          { key: 'tenant_id', label: 'Tenant ID', type: 'text' },
        ];
      case 'email (smtp)':
        return [
          { key: 'sender_email', label: 'Sender Email', type: 'email' },
          { key: 'sender_name', label: 'Sender Name', type: 'text' },
        ];
      case 'calendar sync':
        return [
          { key: 'sync_frequency', label: 'Sync Frequency (minutes)', type: 'number' },
          { key: 'calendar_id', label: 'Calendar ID', type: 'text' },
        ];
      default:
        return [
          { key: 'api_key', label: 'API Key', type: 'password' },
        ];
    }
  };


  const getIntegrationIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'microsoft teams':
        return <Video className="h-6 w-6 text-blue-500" />;
      case 'email (smtp)':
        return <Mail className="h-6 w-6 text-orange-500" />;
      case 'calendar sync':
        return <Calendar className="h-6 w-6 text-green-500" />;
      default:
        return <Settings className="h-6 w-6" />;
    }
  };

  const getStatusBadge = (integration: Integration) => {
    if (!integration.is_enabled) {
      return <Badge variant="secondary">Disabled</Badge>;
    }
    
    switch (integration.sync_status) {
      case 'active':
        return <Badge className="bg-green-500">Active</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Inactive</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">
            Only administrators can manage integrations.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Third-Party Integrations</CardTitle>
            <CardDescription>
              Connect your CRM with external services
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {integrations.map((integration) => (
                <div
                  key={integration.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-muted rounded-lg">
                      {getIntegrationIcon(integration.integration_name)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{integration.integration_name}</span>
                        {getStatusBadge(integration)}
                      </div>
                      {integration.last_sync_at && (
                        <p className="text-sm text-muted-foreground">
                          Last synced: {new Date(integration.last_sync_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Switch
                      checked={integration.is_enabled}
                      onCheckedChange={(checked) => toggleIntegration(integration.id, checked)}
                    />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleConfigureClick(integration)}
                    >
                      Configure
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Integration Status Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Connection Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {integrations.map((integration) => (
                <div
                  key={integration.id}
                  className={`p-4 border rounded-lg ${
                    integration.is_enabled && integration.sync_status === 'active'
                      ? 'border-green-500 bg-green-50 dark:bg-green-950'
                      : integration.is_enabled && integration.sync_status === 'error'
                      ? 'border-red-500 bg-red-50 dark:bg-red-950'
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {integration.is_enabled && integration.sync_status === 'active' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : integration.is_enabled && integration.sync_status === 'error' ? (
                      <XCircle className="h-5 w-5 text-red-500" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
                    )}
                    <span className="font-medium">{integration.integration_name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {integration.is_enabled
                      ? integration.sync_status === 'active'
                        ? 'Connected and syncing'
                        : integration.sync_status === 'error'
                        ? 'Connection error'
                        : 'Pending configuration'
                      : 'Not connected'}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Setup Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Setup Instructions</CardTitle>
            <CardDescription>
              Configure your integrations in the Supabase Edge Function secrets
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Microsoft Teams</h4>
              <p className="text-sm text-muted-foreground">
                Configure AZURE_TEAMS_CLIENT_ID, AZURE_TEAMS_CLIENT_SECRET, and AZURE_TEAMS_TENANT_ID
                in your Supabase Edge Function secrets.
              </p>
              <Button variant="link" className="p-0 h-auto mt-2" asChild>
                <a
                  href="https://supabase.com/dashboard/project/narvjcteixgjclvjvlbn/settings/functions"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Manage Secrets
                </a>
              </Button>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">Email (SMTP)</h4>
              <p className="text-sm text-muted-foreground">
                Configure AZURE_EMAIL_CLIENT_ID, AZURE_EMAIL_CLIENT_SECRET, and AZURE_EMAIL_TENANT_ID
                for Microsoft Graph email integration.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configuration Modal */}
      <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configure {selectedIntegration?.integration_name}</DialogTitle>
            <DialogDescription>
              Update the settings for this integration
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {selectedIntegration && getConfigFields(selectedIntegration.integration_name).map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={field.key}>{field.label}</Label>
                <Input
                  id={field.key}
                  type={field.type}
                  value={configData[field.key] || ''}
                  onChange={(e) => setConfigData(prev => ({
                    ...prev,
                    [field.key]: e.target.value
                  }))}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                />
              </div>
            ))}
            
            <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
              <p>Note: For security-sensitive settings like API keys and secrets, 
              configure them in the Supabase Edge Function secrets.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveConfig} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default IntegrationSettings;