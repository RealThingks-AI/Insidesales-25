import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useUserRole } from '@/hooks/useUserRole';
import { 
  Loader2, 
  Plus, 
  Trash2, 
  GripVertical, 
  Settings2, 
  Check,
  AlertCircle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
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
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface PipelineStage {
  id: string;
  stage_name: string;
  stage_order: number;
  stage_color: string;
  stage_probability: number;
  is_active: boolean;
  is_won_stage: boolean;
  is_lost_stage: boolean;
}

interface LeadStatus {
  id: string;
  status_name: string;
  status_color: string;
  status_order: number;
  is_active: boolean;
  is_converted_status: boolean;
}

const colorOptions = [
  { hex: '#3b82f6', name: 'Blue' },
  { hex: '#6b7280', name: 'Gray' },
  { hex: '#8b5cf6', name: 'Purple' },
  { hex: '#f59e0b', name: 'Amber' },
  { hex: '#10b981', name: 'Emerald' },
  { hex: '#22c55e', name: 'Green' },
  { hex: '#ef4444', name: 'Red' },
  { hex: '#94a3b8', name: 'Slate' },
  { hex: '#ec4899', name: 'Pink' },
  { hex: '#14b8a6', name: 'Teal' }
];

const PipelineSettings = () => {
  const { userRole } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [showStageModal, setShowStageModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [editingStage, setEditingStage] = useState<Partial<PipelineStage> | null>(null);
  const [editingStatus, setEditingStatus] = useState<Partial<LeadStatus> | null>(null);
  const [stageToDelete, setStageToDelete] = useState<PipelineStage | null>(null);
  const [statusToDelete, setStatusToDelete] = useState<LeadStatus | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  
  // Track initial state for unsaved changes detection
  const initialStagesRef = useRef<string>('');
  const initialStatusesRef = useRef<string>('');

  const isAdmin = userRole === 'admin';

  // Check for unsaved changes
  const hasUnsavedChanges = () => {
    return (
      JSON.stringify(stages) !== initialStagesRef.current ||
      JSON.stringify(statuses) !== initialStatusesRef.current
    );
  };

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [stages, statuses]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [stagesRes, statusesRes] = await Promise.all([
        supabase.from('pipeline_stages').select('*').order('stage_order'),
        supabase.from('lead_statuses').select('*').order('status_order'),
      ]);

      if (stagesRes.error) throw stagesRes.error;
      if (statusesRes.error) throw statusesRes.error;

      const stagesData = stagesRes.data || [];
      const statusesData = statusesRes.data || [];
      
      setStages(stagesData);
      setStatuses(statusesData);
      
      // Store initial state
      initialStagesRef.current = JSON.stringify(stagesData);
      initialStatusesRef.current = JSON.stringify(statusesData);
    } catch (error) {
      console.error('Error fetching pipeline data:', error);
      toast.error('Failed to load pipeline settings');
    } finally {
      setLoading(false);
    }
  };

  // Get colors already used by other stages (excluding current editing stage)
  const getUsedStageColors = () => {
    return stages
      .filter(s => s.id !== editingStage?.id)
      .map(s => s.stage_color);
  };

  const getUsedStatusColors = () => {
    return statuses
      .filter(s => s.id !== editingStatus?.id)
      .map(s => s.status_color);
  };

  // Validate stage name
  const validateStageName = (name: string, isStage: boolean = true): string | null => {
    if (!name.trim()) {
      return 'Name is required';
    }
    
    const existingNames = isStage
      ? stages.filter(s => s.id !== editingStage?.id).map(s => s.stage_name.toLowerCase())
      : statuses.filter(s => s.id !== editingStatus?.id).map(s => s.status_name.toLowerCase());
    
    if (existingNames.includes(name.trim().toLowerCase())) {
      return 'This name already exists';
    }
    
    return null;
  };

  const saveStage = async () => {
    const error = validateStageName(editingStage?.stage_name || '', true);
    if (error) {
      setValidationError(error);
      return;
    }
    
    setSaving(true);
    setValidationError(null);

    try {
      if (editingStage?.id) {
        const { error } = await supabase
          .from('pipeline_stages')
          .update(editingStage)
          .eq('id', editingStage.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('pipeline_stages')
          .insert({
            stage_name: editingStage?.stage_name,
            stage_color: editingStage?.stage_color || '#3b82f6',
            stage_probability: editingStage?.stage_probability || 0,
            is_active: editingStage?.is_active ?? true,
            is_won_stage: editingStage?.is_won_stage || false,
            is_lost_stage: editingStage?.is_lost_stage || false,
            stage_order: stages.length,
          });
        if (error) throw error;
      }

      toast.success('Stage saved successfully');
      setShowStageModal(false);
      setEditingStage(null);
      fetchData();
    } catch (error) {
      console.error('Error saving stage:', error);
      toast.error('Failed to save stage');
    } finally {
      setSaving(false);
    }
  };

  const saveStatus = async () => {
    const error = validateStageName(editingStatus?.status_name || '', false);
    if (error) {
      setValidationError(error);
      return;
    }
    
    setSaving(true);
    setValidationError(null);

    try {
      if (editingStatus?.id) {
        const { error } = await supabase
          .from('lead_statuses')
          .update(editingStatus)
          .eq('id', editingStatus.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('lead_statuses')
          .insert({
            status_name: editingStatus?.status_name,
            status_color: editingStatus?.status_color || '#6b7280',
            is_active: editingStatus?.is_active ?? true,
            is_converted_status: editingStatus?.is_converted_status || false,
            status_order: statuses.length,
          });
        if (error) throw error;
      }

      toast.success('Status saved successfully');
      setShowStatusModal(false);
      setEditingStatus(null);
      fetchData();
    } catch (error) {
      console.error('Error saving status:', error);
      toast.error('Failed to save status');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteStage = async () => {
    if (!stageToDelete) return;
    try {
      const { error } = await supabase
        .from('pipeline_stages')
        .delete()
        .eq('id', stageToDelete.id);
      if (error) throw error;
      toast.success('Stage deleted');
      setStageToDelete(null);
      fetchData();
    } catch (error) {
      toast.error('Failed to delete stage');
    }
  };

  const confirmDeleteStatus = async () => {
    if (!statusToDelete) return;
    try {
      const { error } = await supabase
        .from('lead_statuses')
        .delete()
        .eq('id', statusToDelete.id);
      if (error) throw error;
      toast.success('Status deleted');
      setStatusToDelete(null);
      fetchData();
    } catch (error) {
      toast.error('Failed to delete status');
    }
  };

  const handleStageDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    
    const items = Array.from(stages);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Update local state immediately
    const updatedStages = items.map((stage, index) => ({
      ...stage,
      stage_order: index
    }));
    setStages(updatedStages);
    
    // Persist to database
    try {
      const updates = updatedStages.map(stage => ({
        id: stage.id,
        stage_order: stage.stage_order
      }));
      
      for (const update of updates) {
        await supabase
          .from('pipeline_stages')
          .update({ stage_order: update.stage_order })
          .eq('id', update.id);
      }
      
      toast.success('Stage order updated');
    } catch (error) {
      console.error('Error updating stage order:', error);
      toast.error('Failed to update stage order');
      fetchData(); // Rollback on error
    }
  };

  const handleStatusDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    
    const items = Array.from(statuses);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Update local state immediately
    const updatedStatuses = items.map((status, index) => ({
      ...status,
      status_order: index
    }));
    setStatuses(updatedStatuses);
    
    // Persist to database
    try {
      const updates = updatedStatuses.map(status => ({
        id: status.id,
        status_order: status.status_order
      }));
      
      for (const update of updates) {
        await supabase
          .from('lead_statuses')
          .update({ status_order: update.status_order })
          .eq('id', update.id);
      }
      
      toast.success('Status order updated');
    } catch (error) {
      console.error('Error updating status order:', error);
      toast.error('Failed to update status order');
      fetchData(); // Rollback on error
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
            Only administrators can manage pipeline settings.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Deal Pipeline Stages */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Deal Pipeline Stages
              </CardTitle>
              <CardDescription>
                Customize the stages in your deal pipeline
              </CardDescription>
            </div>
            <Button
              onClick={() => {
                setEditingStage({ stage_name: '', stage_color: '#3b82f6', stage_probability: 0 });
                setValidationError(null);
                setShowStageModal(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Stage
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DragDropContext onDragEnd={handleStageDragEnd}>
            <Droppable droppableId="stages">
              {(provided) => (
                <div 
                  className="space-y-2" 
                  {...provided.droppableProps} 
                  ref={provided.innerRef}
                >
                  {stages.map((stage, index) => (
                    <Draggable key={stage.id} draggableId={stage.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                            snapshot.isDragging ? 'bg-muted shadow-md' : 'hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div 
                              {...provided.dragHandleProps}
                              className="cursor-grab active:cursor-grabbing"
                            >
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: stage.stage_color }}
                              aria-label={`Color: ${colorOptions.find(c => c.hex === stage.stage_color)?.name || stage.stage_color}`}
                            />
                            <span className="font-medium">{stage.stage_name}</span>
                            <Badge variant="outline">{stage.stage_probability}%</Badge>
                            {stage.is_won_stage && <Badge className="bg-green-500">Won</Badge>}
                            {stage.is_lost_stage && <Badge variant="destructive">Lost/Dropped</Badge>}
                            {!stage.is_active && <Badge variant="secondary">Inactive</Badge>}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingStage(stage);
                                setValidationError(null);
                                setShowStageModal(true);
                              }}
                              aria-label={`Edit ${stage.stage_name}`}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => setStageToDelete(stage)}
                              aria-label={`Delete ${stage.stage_name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </CardContent>
      </Card>

      {/* Lead Statuses */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lead Statuses</CardTitle>
              <CardDescription>
                Define statuses for tracking leads
              </CardDescription>
            </div>
            <Button
              onClick={() => {
                setEditingStatus({ status_name: '', status_color: '#6b7280' });
                setValidationError(null);
                setShowStatusModal(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Status
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DragDropContext onDragEnd={handleStatusDragEnd}>
            <Droppable droppableId="statuses">
              {(provided) => (
                <div 
                  className="space-y-2" 
                  {...provided.droppableProps} 
                  ref={provided.innerRef}
                >
                  {statuses.map((status, index) => (
                    <Draggable key={status.id} draggableId={status.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                            snapshot.isDragging ? 'bg-muted shadow-md' : 'hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div 
                              {...provided.dragHandleProps}
                              className="cursor-grab active:cursor-grabbing"
                            >
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: status.status_color }}
                              aria-label={`Color: ${colorOptions.find(c => c.hex === status.status_color)?.name || status.status_color}`}
                            />
                            <span className="font-medium">{status.status_name}</span>
                            {status.is_converted_status && <Badge className="bg-green-500">Converted</Badge>}
                            {!status.is_active && <Badge variant="secondary">Inactive</Badge>}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingStatus(status);
                                setValidationError(null);
                                setShowStatusModal(true);
                              }}
                              aria-label={`Edit ${status.status_name}`}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => setStatusToDelete(status)}
                              aria-label={`Delete ${status.status_name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </CardContent>
      </Card>

      {/* Stage Edit Modal */}
      <Dialog open={showStageModal} onOpenChange={(open) => {
        if (!open && hasUnsavedChanges()) {
          setShowUnsavedDialog(true);
        } else {
          setShowStageModal(open);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingStage?.id ? 'Edit Stage' : 'Add Stage'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stage-name">Stage Name</Label>
              <Input
                id="stage-name"
                value={editingStage?.stage_name || ''}
                onChange={(e) => {
                  setEditingStage(s => ({ ...s, stage_name: e.target.value }));
                  setValidationError(null);
                }}
                placeholder="Enter stage name"
                aria-invalid={!!validationError}
                aria-describedby={validationError ? "stage-name-error" : undefined}
              />
              {validationError && (
                <p id="stage-name-error" className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {validationError}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label id="stage-color-label">Color</Label>
              <div 
                className="flex gap-2 flex-wrap" 
                role="radiogroup" 
                aria-labelledby="stage-color-label"
              >
                {colorOptions.map((color) => {
                  const isUsed = getUsedStageColors().includes(color.hex);
                  const isSelected = editingStage?.stage_color === color.hex;
                  return (
                    <button
                      key={color.hex}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`${color.name}${isUsed ? ' (already used)' : ''}`}
                      className={`w-8 h-8 rounded-full border-2 relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                        isSelected ? 'border-foreground' : 'border-transparent'
                      } ${isUsed ? 'opacity-50' : ''}`}
                      style={{ backgroundColor: color.hex }}
                      onClick={() => setEditingStage(s => ({ ...s, stage_color: color.hex }))}
                    >
                      {isSelected && (
                        <Check className="h-4 w-4 text-white absolute inset-0 m-auto drop-shadow" />
                      )}
                      {isUsed && !isSelected && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-muted-foreground rounded-full flex items-center justify-center">
                          <span className="sr-only">Already used</span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stage-probability">Probability (%)</Label>
              <Input
                id="stage-probability"
                type="number"
                min="0"
                max="100"
                value={editingStage?.stage_probability || 0}
                onChange={(e) => setEditingStage(s => ({ ...s, stage_probability: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="stage-active">Active</Label>
              <Switch
                id="stage-active"
                checked={editingStage?.is_active ?? true}
                onCheckedChange={(checked) => setEditingStage(s => ({ ...s, is_active: checked }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="stage-won">Won Stage</Label>
              <Switch
                id="stage-won"
                checked={editingStage?.is_won_stage || false}
                onCheckedChange={(checked) => setEditingStage(s => ({ ...s, is_won_stage: checked, is_lost_stage: false }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="stage-lost">Lost/Dropped Stage</Label>
              <Switch
                id="stage-lost"
                checked={editingStage?.is_lost_stage || false}
                onCheckedChange={(checked) => setEditingStage(s => ({ ...s, is_lost_stage: checked, is_won_stage: false }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStageModal(false)}>
              Cancel
            </Button>
            <Button onClick={saveStage} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Edit Modal */}
      <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingStatus?.id ? 'Edit Status' : 'Add Status'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status-name">Status Name</Label>
              <Input
                id="status-name"
                value={editingStatus?.status_name || ''}
                onChange={(e) => {
                  setEditingStatus(s => ({ ...s, status_name: e.target.value }));
                  setValidationError(null);
                }}
                placeholder="Enter status name"
                aria-invalid={!!validationError}
                aria-describedby={validationError ? "status-name-error" : undefined}
              />
              {validationError && (
                <p id="status-name-error" className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {validationError}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label id="status-color-label">Color</Label>
              <div 
                className="flex gap-2 flex-wrap" 
                role="radiogroup" 
                aria-labelledby="status-color-label"
              >
                {colorOptions.map((color) => {
                  const isUsed = getUsedStatusColors().includes(color.hex);
                  const isSelected = editingStatus?.status_color === color.hex;
                  return (
                    <button
                      key={color.hex}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`${color.name}${isUsed ? ' (already used)' : ''}`}
                      className={`w-8 h-8 rounded-full border-2 relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                        isSelected ? 'border-foreground' : 'border-transparent'
                      } ${isUsed ? 'opacity-50' : ''}`}
                      style={{ backgroundColor: color.hex }}
                      onClick={() => setEditingStatus(s => ({ ...s, status_color: color.hex }))}
                    >
                      {isSelected && (
                        <Check className="h-4 w-4 text-white absolute inset-0 m-auto drop-shadow" />
                      )}
                      {isUsed && !isSelected && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-muted-foreground rounded-full flex items-center justify-center">
                          <span className="sr-only">Already used</span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="status-active">Active</Label>
              <Switch
                id="status-active"
                checked={editingStatus?.is_active ?? true}
                onCheckedChange={(checked) => setEditingStatus(s => ({ ...s, is_active: checked }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="status-converted">Converted Status</Label>
              <Switch
                id="status-converted"
                checked={editingStatus?.is_converted_status || false}
                onCheckedChange={(checked) => setEditingStatus(s => ({ ...s, is_converted_status: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusModal(false)}>
              Cancel
            </Button>
            <Button onClick={saveStatus} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialogs */}
      <DeleteConfirmDialog
        open={!!stageToDelete}
        onOpenChange={(open) => !open && setStageToDelete(null)}
        onConfirm={confirmDeleteStage}
        title="Delete Pipeline Stage"
        description={`Are you sure you want to delete the "${stageToDelete?.stage_name}" stage? Deals in this stage will need to be reassigned.`}
      />

      <DeleteConfirmDialog
        open={!!statusToDelete}
        onOpenChange={(open) => !open && setStatusToDelete(null)}
        onConfirm={confirmDeleteStatus}
        title="Delete Lead Status"
        description={`Are you sure you want to delete the "${statusToDelete?.status_name}" status? Leads with this status will need to be updated.`}
      />

      {/* Unsaved Changes Dialog */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to leave?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowStageModal(false);
              setShowUnsavedDialog(false);
            }}>
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PipelineSettings;
