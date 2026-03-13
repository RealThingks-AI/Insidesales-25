import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  GitBranch, 
  Plus, 
  Pencil, 
  Trash2, 
  RefreshCw,
  UserCheck,
  ArrowRight
} from 'lucide-react';
import { format } from 'date-fns';

interface ApprovalWorkflow {
  id: string;
  name: string;
  entity_type: string;
  trigger_conditions: any;
  approval_steps: {
    step: number;
    role: string;
    user_id?: string;
  }[];
  is_enabled: boolean;
  created_at: string;
}

const entityTypes = [
  { value: 'deals', label: 'Deals' },
  { value: 'leads', label: 'Leads' },
  { value: 'accounts', label: 'Accounts' },
];

const conditionFields = {
  deals: [
    { value: 'total_revenue', label: 'Total Revenue' },
    { value: 'total_contract_value', label: 'Contract Value' },
    { value: 'probability', label: 'Probability (%)' },
  ],
  leads: [
    { value: 'lead_status', label: 'Lead Status' },
  ],
  accounts: [
    { value: 'total_revenue', label: 'Total Revenue' },
    { value: 'score', label: 'Account Score' },
  ],
};

const operators = [
  { value: '>=', label: 'Greater than or equal' },
  { value: '>', label: 'Greater than' },
  { value: '<=', label: 'Less than or equal' },
  { value: '<', label: 'Less than' },
  { value: '=', label: 'Equal to' },
];

const ApprovalWorkflowSettings = () => {
  const { user } = useAuth();
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<ApprovalWorkflow | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    entity_type: 'deals',
    condition_field: 'total_revenue',
    condition_operator: '>=',
    condition_value: '100000',
    approval_steps: [{ step: 1, role: 'manager' }],
    is_enabled: true,
  });

  const fetchWorkflows = async () => {
    try {
      const { data, error } = await supabase
        .from('approval_workflows')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Map the data to match our interface, casting JSON fields
      const mappedWorkflows: ApprovalWorkflow[] = (data || []).map(item => ({
        ...item,
        trigger_conditions: item.trigger_conditions as any,
        approval_steps: (item.approval_steps as any) || [],
      }));
      
      setWorkflows(mappedWorkflows);
    } catch (error) {
      console.error('Error fetching workflows:', error);
      toast.error('Failed to load approval workflows');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const handleOpenModal = (workflow?: ApprovalWorkflow) => {
    if (workflow) {
      setEditingWorkflow(workflow);
      const condition = workflow.trigger_conditions;
      setFormData({
        name: workflow.name,
        entity_type: workflow.entity_type,
        condition_field: condition?.field || 'total_revenue',
        condition_operator: condition?.operator || '>=',
        condition_value: condition?.value?.toString() || '100000',
        approval_steps: workflow.approval_steps || [{ step: 1, role: 'manager' }],
        is_enabled: workflow.is_enabled,
      });
    } else {
      setEditingWorkflow(null);
      setFormData({
        name: '',
        entity_type: 'deals',
        condition_field: 'total_revenue',
        condition_operator: '>=',
        condition_value: '100000',
        approval_steps: [{ step: 1, role: 'manager' }],
        is_enabled: true,
      });
    }
    setShowModal(true);
  };

  const handleAddStep = () => {
    setFormData({
      ...formData,
      approval_steps: [
        ...formData.approval_steps,
        { step: formData.approval_steps.length + 1, role: 'manager' }
      ]
    });
  };

  const handleRemoveStep = (index: number) => {
    const newSteps = formData.approval_steps.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      approval_steps: newSteps.map((s, i) => ({ ...s, step: i + 1 }))
    });
  };

  const handleStepRoleChange = (index: number, role: string) => {
    const newSteps = [...formData.approval_steps];
    newSteps[index] = { ...newSteps[index], role };
    setFormData({ ...formData, approval_steps: newSteps });
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error('Workflow name is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        entity_type: formData.entity_type,
        trigger_conditions: {
          field: formData.condition_field,
          operator: formData.condition_operator,
          value: isNaN(Number(formData.condition_value)) 
            ? formData.condition_value 
            : Number(formData.condition_value),
        },
        approval_steps: formData.approval_steps,
        is_enabled: formData.is_enabled,
        created_by: user?.id,
      };

      if (editingWorkflow) {
        const { error } = await supabase
          .from('approval_workflows')
          .update(payload)
          .eq('id', editingWorkflow.id);

        if (error) throw error;
        toast.success('Workflow updated successfully');
      } else {
        const { error } = await supabase
          .from('approval_workflows')
          .insert(payload);

        if (error) throw error;
        toast.success('Workflow created successfully');
      }

      setShowModal(false);
      fetchWorkflows();
    } catch (error) {
      console.error('Error saving workflow:', error);
      toast.error('Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;

    try {
      const { error } = await supabase
        .from('approval_workflows')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Workflow deleted');
      fetchWorkflows();
    } catch (error) {
      console.error('Error deleting workflow:', error);
      toast.error('Failed to delete workflow');
    }
  };

  const handleToggleEnabled = async (id: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from('approval_workflows')
        .update({ is_enabled: !currentState })
        .eq('id', id);

      if (error) throw error;
      fetchWorkflows();
    } catch (error) {
      console.error('Error toggling workflow:', error);
      toast.error('Failed to update workflow');
    }
  };

  const getConditionLabel = (workflow: ApprovalWorkflow) => {
    const condition = workflow.trigger_conditions;
    if (!condition) return 'No conditions';
    
    const op = operators.find(o => o.value === condition.operator)?.label || condition.operator;
    return `${condition.field} ${op} ${condition.value}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Approval Workflows</h3>
          <p className="text-sm text-muted-foreground">
            Configure approval processes for deals, leads, and accounts
          </p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="h-4 w-4 mr-2" />
          New Workflow
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : workflows.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No approval workflows yet</p>
              <p className="text-sm">Create a workflow to require approvals for specific actions</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {workflows.map((workflow) => (
            <Card key={workflow.id} className={!workflow.is_enabled ? 'opacity-60' : ''}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <GitBranch className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{workflow.name}</h4>
                        <Badge variant="outline" className="capitalize">
                          {workflow.entity_type}
                        </Badge>
                        {!workflow.is_enabled && (
                          <Badge variant="secondary">Disabled</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Trigger: {getConditionLabel(workflow)}
                      </p>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Steps:</span>
                        {workflow.approval_steps.map((step, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <Badge variant="secondary" className="capitalize">
                              <UserCheck className="h-3 w-3 mr-1" />
                              {step.role}
                            </Badge>
                            {i < workflow.approval_steps.length - 1 && (
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={workflow.is_enabled}
                      onCheckedChange={() => handleToggleEnabled(workflow.id, workflow.is_enabled)}
                    />
                    <Button variant="ghost" size="icon" onClick={() => handleOpenModal(workflow)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(workflow.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingWorkflow ? 'Edit Approval Workflow' : 'Create Approval Workflow'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Workflow Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="High Value Deal Approval"
              />
            </div>

            <div className="space-y-2">
              <Label>Entity Type</Label>
              <Select 
                value={formData.entity_type} 
                onValueChange={(v) => setFormData({ ...formData, entity_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {entityTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Trigger Condition</Label>
              <div className="grid grid-cols-3 gap-2">
                <Select 
                  value={formData.condition_field} 
                  onValueChange={(v) => setFormData({ ...formData, condition_field: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {conditionFields[formData.entity_type as keyof typeof conditionFields]?.map((field) => (
                      <SelectItem key={field.value} value={field.value}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select 
                  value={formData.condition_operator} 
                  onValueChange={(v) => setFormData({ ...formData, condition_operator: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {operators.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  value={formData.condition_value}
                  onChange={(e) => setFormData({ ...formData, condition_value: e.target.value })}
                  placeholder="100000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Approval Steps</Label>
                <Button variant="outline" size="sm" onClick={handleAddStep}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Step
                </Button>
              </div>
              <div className="space-y-2">
                {formData.approval_steps.map((step, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-16">Step {step.step}:</span>
                    <Select 
                      value={step.role} 
                      onValueChange={(v) => handleStepRoleChange(index, v)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    {formData.approval_steps.length > 1 && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleRemoveStep(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, is_enabled: checked })}
              />
              <Label>Enabled</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editingWorkflow ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApprovalWorkflowSettings;