import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { 
  Download, 
  Upload, 
  FileText,
  Users,
  Building2,
  Briefcase,
  Calendar,
  CheckSquare,
  RefreshCw,
  FileDown
} from 'lucide-react';
import { useSimpleLeadsImportExport } from '@/hooks/useSimpleLeadsImportExport';
import { useSimpleContactsImportExport } from '@/hooks/useSimpleContactsImportExport';
import { useAccountsImportExport } from '@/hooks/useAccountsImportExport';
import { useDealsImportExport } from '@/hooks/useDealsImportExport';
import { useMeetingsImportExport } from '@/hooks/useMeetingsImportExport';
import { useTasksImportExport } from '@/hooks/useTasksImportExport';

interface ModuleConfig {
  id: string;
  name: string;
  table: string;
  icon: React.ReactNode;
  color: string;
}

const MODULES: ModuleConfig[] = [
  { id: 'leads', name: 'Leads', table: 'leads', icon: <FileText className="h-5 w-5" />, color: 'border-l-blue-500' },
  { id: 'contacts', name: 'Contacts', table: 'contacts', icon: <Users className="h-5 w-5" />, color: 'border-l-green-500' },
  { id: 'accounts', name: 'Accounts', table: 'accounts', icon: <Building2 className="h-5 w-5" />, color: 'border-l-purple-500' },
  { id: 'deals', name: 'Deals', table: 'deals', icon: <Briefcase className="h-5 w-5" />, color: 'border-l-orange-500' },
  { id: 'meetings', name: 'Meetings', table: 'meetings', icon: <Calendar className="h-5 w-5" />, color: 'border-l-pink-500' },
  { id: 'tasks', name: 'Tasks', table: 'tasks', icon: <CheckSquare className="h-5 w-5" />, color: 'border-l-cyan-500' },
];

const ModuleImportExport = () => {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [activeImport, setActiveImport] = useState<string | null>(null);
  const [activeExport, setActiveExport] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Import/Export hooks
  const leadsHook = useSimpleLeadsImportExport(() => fetchCounts());
  const contactsHook = useSimpleContactsImportExport(() => fetchCounts());
  const accountsHook = useAccountsImportExport(() => fetchCounts());
  const dealsHook = useDealsImportExport({ onRefresh: () => fetchCounts() });
  const meetingsHook = useMeetingsImportExport(() => fetchCounts());
  const tasksHook = useTasksImportExport([], () => fetchCounts());

  const fetchCounts = async () => {
    setLoading(true);
    try {
      const countPromises = MODULES.map(async (module) => {
        const { count } = await supabase
          .from(module.table as any)
          .select('*', { count: 'exact', head: true });
        return { [module.id]: count || 0 };
      });

      const results = await Promise.all(countPromises);
      const countsObj = results.reduce((acc, curr) => ({ ...acc, ...curr }), {});
      setCounts(countsObj);
    } catch (error) {
      console.error('Error fetching counts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCounts();
  }, []);

  const handleImportClick = (moduleId: string) => {
    fileInputRefs.current[moduleId]?.click();
  };

  const handleFileChange = async (moduleId: string, file: File | null) => {
    if (!file) return;

    setActiveImport(moduleId);
    try {
      switch (moduleId) {
        case 'leads':
          await leadsHook.handleImport(file);
          break;
        case 'contacts':
          await contactsHook.handleImport(file);
          break;
        case 'accounts':
          await accountsHook.handleImport(file);
          break;
        case 'deals':
          await dealsHook.handleImport(file);
          break;
        case 'meetings':
          await meetingsHook.handleImport(file);
          break;
        case 'tasks':
          await tasksHook.importFromCSV(file);
          break;
      }
      await fetchCounts();
    } catch (error: any) {
      console.error(`Error importing ${moduleId}:`, error);
      toast.error(`Failed to import ${moduleId}: ${error.message}`);
    } finally {
      setActiveImport(null);
      // Reset file input
      if (fileInputRefs.current[moduleId]) {
        fileInputRefs.current[moduleId]!.value = '';
      }
    }
  };

  const handleExport = async (moduleId: string) => {
    setActiveExport(moduleId);
    try {
      switch (moduleId) {
        case 'leads':
          await leadsHook.handleExport();
          break;
        case 'contacts':
          await contactsHook.handleExport();
          break;
        case 'accounts':
          await accountsHook.handleExport();
          break;
        case 'deals':
          // Fetch deals data for export
          const { data: dealsData } = await supabase
            .from('deals')
            .select('*');
          if (dealsData && dealsData.length > 0) {
            await dealsHook.handleExportAll(dealsData);
          } else {
            toast.error('No deals to export');
            return;
          }
          break;
        case 'meetings':
          // Fetch meetings data for export
          const { data: meetingsData } = await supabase
            .from('meetings')
            .select('*');
          if (meetingsData && meetingsData.length > 0) {
            await meetingsHook.handleExport(meetingsData as any);
          } else {
            toast.error('No meetings to export');
            return;
          }
          break;
        case 'tasks':
          // Fetch tasks data for export
          const { data: tasksData } = await supabase
            .from('tasks')
            .select(`
              *,
              accounts(company_name),
              contacts(contact_name),
              leads(lead_name),
              deals(deal_name),
              meetings(subject)
            `);
          if (tasksData && tasksData.length > 0) {
            await tasksHook.exportToCSV();
          } else {
            toast.error('No tasks to export');
            return;
          }
          break;
      }
      toast.success(`${moduleId} exported successfully`);
    } catch (error: any) {
      console.error(`Error exporting ${moduleId}:`, error);
      toast.error(`Failed to export ${moduleId}: ${error.message}`);
    } finally {
      setActiveExport(null);
    }
  };

  const downloadTemplate = (moduleId: string) => {
    const templates: Record<string, string> = {
      leads: 'Lead Name,Company Name,Email,Phone,Position,Lead Status,Contact Source,Industry,Country,LinkedIn,Website,Description',
      contacts: 'Contact Name,Company Name,Position,Email,Phone,LinkedIn,Contact Source,Tags,Description',
      accounts: 'Company Name,Email,Phone,Website,Industry,Region,Country,Status,Tags,Notes',
      deals: 'Deal Name,Customer Name,Stage,Total Contract Value,Expected Closing Date,Priority,Probability,Region',
      meetings: 'Subject,Description,Start Time,End Time,Status,Outcome,Notes',
      tasks: 'Title,Description,Status,Priority,Due Date,Due Time,Category,Module Type',
    };

    const template = templates[moduleId];
    if (!template) return;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${moduleId}_template.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success(`${moduleId} template downloaded`);
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5" />
              Module Import / Export
            </CardTitle>
            <CardDescription>Import and export data for individual modules</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchCounts} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map((module) => (
            <Card key={module.id} className={`border-l-4 ${module.color}`}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      {module.icon}
                    </div>
                    <div>
                      <h4 className="font-medium">{module.name}</h4>
                      <Badge variant="secondary" className="mt-1">
                        {loading ? '...' : `${counts[module.id]?.toLocaleString() || 0} records`}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleImportClick(module.id)}
                      disabled={activeImport === module.id}
                    >
                      {activeImport === module.id ? (
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Upload className="h-3 w-3 mr-1" />
                      )}
                      Import
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleExport(module.id)}
                      disabled={activeExport === module.id || counts[module.id] === 0}
                    >
                      {activeExport === module.id ? (
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Download className="h-3 w-3 mr-1" />
                      )}
                      Export
                    </Button>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full text-muted-foreground"
                    onClick={() => downloadTemplate(module.id)}
                  >
                    <FileDown className="h-3 w-3 mr-1" />
                    Download Template
                  </Button>
                </div>

                {/* Hidden file input */}
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  ref={(el) => { fileInputRefs.current[module.id] = el; }}
                  onChange={(e) => handleFileChange(module.id, e.target.files?.[0] || null)}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ModuleImportExport;