import { useState } from 'react';
import { useCampaignEmailTemplates } from '@/hooks/useCampaigns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Send } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { EMAIL_TYPES, AUDIENCE_SEGMENTS } from '@/types/campaign';

interface Props {
  campaignId: string;
  onUseTemplate?: (templateId: string) => void;
}

const emptyForm = { template_name: '', subject: '', body: '', email_type: '', audience_segment: '' };

export function CampaignEmailTemplatesTab({ campaignId, onUseTemplate }: Props) {
  const { query, createTemplate, updateTemplate, deleteTemplate } = useCampaignEmailTemplates(campaignId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const templates = query.data || [];

  const openCreate = () => { setEditId(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (t: any) => {
    setEditId(t.id);
    setForm({ template_name: t.template_name || '', subject: t.subject || '', body: t.body || '', email_type: t.email_type || '', audience_segment: t.audience_segment || '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.template_name.trim()) return;
    if (editId) {
      await updateTemplate.mutateAsync({ id: editId, ...form });
    } else {
      await createTemplate.mutateAsync(form);
    }
    setDialogOpen(false);
  };

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  if (query.isLoading) return <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Email Templates</h3>
        <Button size="sm" variant="outline" onClick={openCreate}><Plus className="h-3 w-3 mr-1" /> Add Template</Button>
      </div>

      {templates.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No email templates yet</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template Name</TableHead>
              <TableHead>Email Type</TableHead>
              <TableHead>Audience</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead className="w-28"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((t: any) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.template_name}</TableCell>
                <TableCell>{t.email_type ? <Badge variant="outline">{t.email_type}</Badge> : '—'}</TableCell>
                <TableCell className="text-sm">{t.audience_segment || '—'}</TableCell>
                <TableCell className="text-sm truncate max-w-[200px]">{t.subject || '—'}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {onUseTemplate && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" title="Use Template" onClick={() => onUseTemplate(t.id)}>
                        <Send className="h-3 w-3" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(t.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? 'Edit Template' : 'New Email Template'}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div><Label>Template Name *</Label><Input value={form.template_name} onChange={e => set('template_name', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email Type</Label>
                <Select value={form.email_type} onValueChange={v => set('email_type', v)}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>{EMAIL_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Audience Segment</Label>
                <Select value={form.audience_segment} onValueChange={v => set('audience_segment', v)}>
                  <SelectTrigger><SelectValue placeholder="Select audience" /></SelectTrigger>
                  <SelectContent>{AUDIENCE_SEGMENTS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Subject</Label><Input value={form.subject} onChange={e => set('subject', e.target.value)} /></div>
            <div><Label>Body</Label><Textarea value={form.body} onChange={e => set('body', e.target.value)} rows={6} /></div>
            <p className="text-xs text-muted-foreground">
              Supported placeholders: <code className="bg-muted px-1 rounded">{'{{contact_name}}'}</code> <code className="bg-muted px-1 rounded">{'{{company_name}}'}</code> <code className="bg-muted px-1 rounded">{'{{email}}'}</code> <code className="bg-muted px-1 rounded">{'{{position}}'}</code> <code className="bg-muted px-1 rounded">{'{{sender_name}}'}</code>
            </p>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.template_name.trim()}>{editId ? 'Save' : 'Create'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this email template? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) { deleteTemplate.mutate(deleteId); setDeleteId(null); } }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
