import { useState } from 'react';
import { useCampaignPhoneScripts } from '@/hooks/useCampaigns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AUDIENCE_SEGMENTS } from '@/types/campaign';

interface Props {
  campaignId: string;
}

const emptyForm = { script_name: '', opening_script: '', key_talking_points: '', discovery_questions: '', objection_handling: '', audience_segment: '' };

export function CampaignPhoneScriptsTab({ campaignId }: Props) {
  const { query, createScript, updateScript, deleteScript } = useCampaignPhoneScripts(campaignId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const scripts = query.data || [];

  const openCreate = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (s: any) => {
    setEditId(s.id);
    setForm({
      script_name: s.script_name || '', opening_script: s.opening_script || '',
      key_talking_points: s.key_talking_points || '', discovery_questions: s.discovery_questions || '',
      objection_handling: s.objection_handling || '', audience_segment: s.audience_segment || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.script_name.trim()) return;
    if (editId) {
      await updateScript.mutateAsync({ id: editId, ...form });
    } else {
      await createScript.mutateAsync(form);
    }
    setDialogOpen(false);
  };

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  if (query.isLoading) return <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Phone Scripts</h3>
        <Button size="sm" variant="outline" onClick={openCreate}><Plus className="h-3 w-3 mr-1" /> Add Script</Button>
      </div>

      {scripts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No phone scripts yet</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Script Name</TableHead>
              <TableHead>Audience</TableHead>
              <TableHead>Opening</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scripts.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.script_name || '—'}</TableCell>
                <TableCell>{s.audience_segment ? <Badge variant="outline">{s.audience_segment}</Badge> : '—'}</TableCell>
                <TableCell className="text-sm truncate max-w-[250px]">{s.opening_script || '—'}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(s.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? 'Edit Script' : 'New Phone Script'}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Script Name *</Label><Input value={form.script_name} onChange={e => set('script_name', e.target.value)} /></div>
              <div>
                <Label>Audience Segment</Label>
                <Select value={form.audience_segment} onValueChange={v => set('audience_segment', v)}>
                  <SelectTrigger><SelectValue placeholder="Select audience" /></SelectTrigger>
                  <SelectContent>{AUDIENCE_SEGMENTS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Opening Script</Label><Textarea value={form.opening_script} onChange={e => set('opening_script', e.target.value)} rows={3} /></div>
            <div><Label>Key Talking Points</Label><Textarea value={form.key_talking_points} onChange={e => set('key_talking_points', e.target.value)} rows={3} /></div>
            <div><Label>Discovery Questions</Label><Textarea value={form.discovery_questions} onChange={e => set('discovery_questions', e.target.value)} rows={3} /></div>
            <div><Label>Objection Handling</Label><Textarea value={form.objection_handling} onChange={e => set('objection_handling', e.target.value)} rows={3} /></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.script_name.trim()}>{editId ? 'Save' : 'Create'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Script</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this phone script? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) { deleteScript.mutate(deleteId); setDeleteId(null); } }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
