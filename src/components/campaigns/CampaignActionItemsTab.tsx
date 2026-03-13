import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, CheckCircle2, Circle, Clock, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useUserDisplayNames } from '@/hooks/useUserDisplayNames';

interface Props {
  campaignId: string;
}

const STATUS_OPTIONS = ['Open', 'In Progress', 'Completed'];
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High'];

const statusIcons: Record<string, any> = {
  Open: Circle,
  'In Progress': Clock,
  Completed: CheckCircle2,
};

const priorityColors: Record<string, string> = {
  High: 'bg-destructive/10 text-destructive',
  Medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  Low: 'bg-muted text-muted-foreground',
};

export function CampaignActionItemsTab({ campaignId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    status: 'Open',
    due_date: '',
    assigned_to: '',
  });

  const profilesQuery = useQuery({
    queryKey: ['profiles_for_action_items'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name');
      return data || [];
    },
    enabled: !!user,
  });

  const query = useQuery({
    queryKey: ['campaign_action_items', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('action_items')
        .select('*')
        .eq('module_type', 'campaigns')
        .eq('module_id', campaignId)
        .is('archived_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createItem = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('action_items').insert({
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        status: form.status,
        due_date: form.due_date || null,
        assigned_to: form.assigned_to || null,
        module_type: 'campaigns',
        module_id: campaignId,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign_action_items', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['actionItems'] });
      toast({ title: 'Action item created' });
      setCreateOpen(false);
      setForm({ title: '', description: '', priority: 'Medium', status: 'Open', due_date: '', assigned_to: '' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('action_items').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign_action_items', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['actionItems'] });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('action_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign_action_items', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['actionItems'] });
      toast({ title: 'Action item deleted' });
    },
  });

  const items = query.data || [];
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-foreground">Action Items ({items.length})</span>
        <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3 w-3 mr-1" /> Add Task
        </Button>
      </div>

      {!items.length ? (
        <p className="text-sm text-muted-foreground text-center py-8">No action items yet. Create tasks for follow-ups, calls, and meetings.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(item => {
              const StatusIcon = statusIcons[item.status] || Circle;
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      {item.description && <p className="text-xs text-muted-foreground truncate max-w-[250px]">{item.description}</p>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={priorityColors[item.priority] || ''}>
                      {item.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Select value={item.status} onValueChange={v => updateStatus.mutate({ id: item.id, status: v })}>
                      <SelectTrigger className="h-7 w-[120px] text-xs">
                        <div className="flex items-center gap-1">
                          <StatusIcon className="h-3 w-3" />
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.due_date ? format(new Date(item.due_date), 'dd MMM yyyy') : '—'}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteItem.mutate(item.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create Action Item</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label>Task Title</Label>
              <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Follow up with contact" className="h-9" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => set('priority', v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITY_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => set('status', v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Due Date</Label>
                <Input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className="h-9" />
              </div>
            </div>
            <div>
              <Label>Assigned To</Label>
              <Select value={form.assigned_to} onValueChange={v => set('assigned_to', v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select user (optional)" /></SelectTrigger>
                <SelectContent>
                  {(profilesQuery.data || []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name || 'Unnamed'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createItem.mutate()} disabled={!form.title.trim() || createItem.isPending}>
              {createItem.isPending ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
