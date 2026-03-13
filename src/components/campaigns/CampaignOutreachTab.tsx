import { useState, useEffect } from 'react';
import { useCampaignCommunications, useCampaignContacts, useCampaignAccounts, useCampaignEmailTemplates } from '@/hooks/useCampaigns';
import { useUserDisplayNames } from '@/hooks/useUserDisplayNames';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Mail, Phone, Linkedin, Calendar, RefreshCw, Send } from 'lucide-react';
import { COMMUNICATION_TYPES, EMAIL_TYPES, EMAIL_STATUSES, CALL_OUTCOMES, LINKEDIN_STATUSES } from '@/types/campaign';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

const typeIcons: Record<string, any> = {
  Email: Mail,
  Phone: Phone,
  LinkedIn: Linkedin,
  Meeting: Calendar,
  'Follow Up': RefreshCw,
};

interface Props {
  campaignId: string;
  initialTemplateId?: string | null;
  onTemplatePicked?: () => void;
}

export function CampaignOutreachTab({ campaignId, initialTemplateId, onTemplatePicked }: Props) {
  const { query, addCommunication } = useCampaignCommunications(campaignId);
  const contactsQuery = useCampaignContacts(campaignId);
  const accountsQuery = useCampaignAccounts(campaignId);
  const templatesQuery = useCampaignEmailTemplates(campaignId);
  const { user } = useAuth();
  const { toast } = useToast();
  const [logOpen, setLogOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [sending, setSending] = useState(false);

  // Fetch sender's display name for {{sender_name}} placeholder
  const senderNameQuery = useQuery({
    queryKey: ['profile_sender', user?.id],
    queryFn: async () => {
      if (!user?.id) return '';
      const { data } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
      return data?.full_name || user.email || '';
    },
    enabled: !!user?.id,
  });
  const senderName = senderNameQuery.data || '';
  const [form, setForm] = useState({
    communication_type: 'Email',
    contact_id: '',
    account_id: '',
    subject: '',
    body: '',
    email_type: '',
    email_status: 'Sent',
    linkedin_status: '',
    call_outcome: '',
    notes: '',
    outcome: '',
  });
  const [sendForm, setSendForm] = useState({
    contact_id: '',
    account_id: '',
    subject: '',
    body: '',
    template_id: '',
  });

  const ownerIds = [...new Set((query.data || []).filter(c => c.owner || c.created_by).map(c => c.owner || c.created_by).filter(Boolean) as string[])];
  const { displayNames } = useUserDisplayNames(ownerIds);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleLog = async () => {
    await addCommunication.mutateAsync({
      communication_type: form.communication_type,
      contact_id: form.contact_id || null,
      account_id: form.account_id || null,
      subject: form.subject || null,
      body: form.body || null,
      email_type: form.email_type || null,
      email_status: form.communication_type === 'Email' ? form.email_status : null,
      linkedin_status: form.communication_type === 'LinkedIn' ? form.linkedin_status : null,
      call_outcome: form.communication_type === 'Phone' ? form.call_outcome : null,
      notes: form.notes || null,
      outcome: form.outcome || null,
    });
    setLogOpen(false);
    setForm({ communication_type: 'Email', contact_id: '', account_id: '', subject: '', body: '', email_type: '', email_status: 'Sent', linkedin_status: '', call_outcome: '', notes: '', outcome: '' });
  };

  const contacts = contactsQuery.query.data || [];
  const accounts = accountsQuery.query.data || [];
  const templates = templatesQuery.query.data || [];

  // Handle template passed from Templates tab
  useEffect(() => {
    if (initialTemplateId && templates.length > 0) {
      openSendDialog(initialTemplateId);
      onTemplatePicked?.();
    }
  }, [initialTemplateId, templates]);

  const openSendDialog = (templateId?: string) => {
    if (templateId) {
      const t = templates.find(t => t.id === templateId);
      if (t) {
        setSendForm({ contact_id: '', account_id: '', subject: t.subject || '', body: t.body || '', template_id: templateId });
      }
    } else {
      setSendForm({ contact_id: '', account_id: '', subject: '', body: '', template_id: '' });
    }
    setSendOpen(true);
  };

  const handleTemplateChange = (templateId: string) => {
    const t = templates.find(t => t.id === templateId);
    if (t) {
      setSendForm(f => ({ ...f, template_id: templateId, subject: t.subject || '', body: t.body || '' }));
    }
  };

  const handleSendEmail = async () => {
    if (!sendForm.contact_id || !sendForm.subject || !sendForm.body) {
      toast({ title: 'Please fill in contact, subject and body', variant: 'destructive' });
      return;
    }

    const contact = contacts.find(c => c.contact_id === sendForm.contact_id);
    const recipientEmail = contact?.contacts?.email;
    if (!recipientEmail) {
      toast({ title: 'Selected contact has no email address', variant: 'destructive' });
      return;
    }

    // Process template placeholders
    const processedSubject = sendForm.subject
      .replace(/\{\{contact_name\}\}/gi, contact?.contacts?.contact_name || '')
      .replace(/\{\{company_name\}\}/gi, contact?.contacts?.company_name || '')
      .replace(/\{\{email\}\}/gi, contact?.contacts?.email || '')
      .replace(/\{\{position\}\}/gi, contact?.contacts?.position || '')
      .replace(/\{\{sender_name\}\}/gi, senderName);
    const processedBody = sendForm.body
      .replace(/\{\{contact_name\}\}/gi, contact?.contacts?.contact_name || '')
      .replace(/\{\{company_name\}\}/gi, contact?.contacts?.company_name || '')
      .replace(/\{\{email\}\}/gi, contact?.contacts?.email || '')
      .replace(/\{\{position\}\}/gi, contact?.contacts?.position || '')
      .replace(/\{\{sender_name\}\}/gi, senderName);

    setSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-campaign-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          recipientEmail,
          recipientName: contact?.contacts?.contact_name || '',
          subject: processedSubject,
          body: processedBody,
          contactId: sendForm.contact_id,
          accountId: sendForm.account_id || null,
          campaignId,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to send email');

      toast({ title: 'Email sent successfully' });
      setSendOpen(false);
      // Refresh communications list and contacts
      query.refetch();
      contactsQuery.query.refetch();
    } catch (err: any) {
      toast({ title: 'Error sending email', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-foreground">Communications ({query.data?.length || 0})</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => openSendDialog()}>
            <Send className="h-3 w-3 mr-1" /> Send Email
          </Button>
          <Button size="sm" variant="outline" onClick={() => setLogOpen(true)}>
            <Plus className="h-3 w-3 mr-1" /> Log Communication
          </Button>
        </div>
      </div>

      {!query.data?.length ? (
        <p className="text-sm text-muted-foreground text-center py-8">No communications logged yet</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status/Outcome</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.data.map(c => {
              const Icon = typeIcons[c.communication_type] || Mail;
              const statusText = c.email_status || c.call_outcome || c.linkedin_status || c.outcome || '—';
              const ownerId = c.owner || c.created_by;
              const ownerName = ownerId ? (displayNames[ownerId] || '—') : '—';
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {c.communication_type}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{(c as any).contacts?.contact_name || '—'}</TableCell>
                  <TableCell className="text-sm">{(c as any).accounts?.account_name || '—'}</TableCell>
                  <TableCell className="text-sm">{c.subject || '—'}</TableCell>
                  <TableCell className="text-sm">{statusText}</TableCell>
                  <TableCell className="text-sm">{ownerName}</TableCell>
                  <TableCell className="text-sm">{format(new Date(c.communication_date), 'dd MMM yyyy')}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{c.notes || '—'}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Send Email Dialog */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Send Campaign Email</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Contact *</Label>
                <Select value={sendForm.contact_id} onValueChange={v => setSendForm(f => ({ ...f, contact_id: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select contact" /></SelectTrigger>
                  <SelectContent>
                    {contacts.filter(c => c.contacts?.email).map(c => (
                      <SelectItem key={c.contact_id} value={c.contact_id}>
                        {c.contacts?.contact_name || c.contact_id}
                        <span className="text-muted-foreground ml-1 text-xs">({c.contacts?.email})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Account</Label>
                <Select value={sendForm.account_id} onValueChange={v => setSendForm(f => ({ ...f, account_id: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {accounts.map(a => (
                      <SelectItem key={a.account_id} value={a.account_id}>{a.accounts?.account_name || a.account_id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {templates.length > 0 && (
              <div>
                <Label>Email Template</Label>
                <Select value={sendForm.template_id} onValueChange={handleTemplateChange}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Choose template (optional)" /></SelectTrigger>
                  <SelectContent>
                    {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.template_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Subject *</Label>
              <Input value={sendForm.subject} onChange={e => setSendForm(f => ({ ...f, subject: e.target.value }))} className="h-9" />
            </div>
            <div>
              <Label>Body *</Label>
              <Textarea value={sendForm.body} onChange={e => setSendForm(f => ({ ...f, body: e.target.value }))} rows={6} />
            </div>
            <p className="text-xs text-muted-foreground">
              Supported placeholders: <code className="bg-muted px-1 rounded">{'{{contact_name}}'}</code> <code className="bg-muted px-1 rounded">{'{{company_name}}'}</code> <code className="bg-muted px-1 rounded">{'{{email}}'}</code> <code className="bg-muted px-1 rounded">{'{{position}}'}</code> <code className="bg-muted px-1 rounded">{'{{sender_name}}'}</code>
            </p>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" onClick={() => setSendOpen(false)}>Cancel</Button>
            <Button onClick={handleSendEmail} disabled={sending || !sendForm.contact_id || !sendForm.subject || !sendForm.body}>
              <Send className="h-3 w-3 mr-1" />
              {sending ? 'Sending...' : 'Send Email'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Log Communication Dialog */}
      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Log Communication</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.communication_type} onValueChange={v => set('communication_type', v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMMUNICATION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Contact</Label>
                <Select value={form.contact_id} onValueChange={v => set('contact_id', v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select contact" /></SelectTrigger>
                  <SelectContent>
                    {contacts.map(c => (
                      <SelectItem key={c.contact_id} value={c.contact_id}>{c.contacts?.contact_name || c.contact_id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Account</Label>
              <Select value={form.account_id} onValueChange={v => set('account_id', v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select account (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {accounts.map(a => (
                    <SelectItem key={a.account_id} value={a.account_id}>{a.accounts?.account_name || a.account_id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject</Label>
              <Input value={form.subject} onChange={e => set('subject', e.target.value)} className="h-9" />
            </div>

            {form.communication_type === 'Email' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Email Type</Label>
                  <Select value={form.email_type} onValueChange={v => set('email_type', v)}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{EMAIL_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Email Status</Label>
                  <Select value={form.email_status} onValueChange={v => set('email_status', v)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{EMAIL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {form.communication_type === 'Phone' && (
              <div>
                <Label>Call Outcome</Label>
                <Select value={form.call_outcome} onValueChange={v => set('call_outcome', v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select outcome" /></SelectTrigger>
                  <SelectContent>{CALL_OUTCOMES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            {form.communication_type === 'LinkedIn' && (
              <>
                <div>
                  <Label>LinkedIn Status</Label>
                  <Select value={form.linkedin_status} onValueChange={v => set('linkedin_status', v)}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select status" /></SelectTrigger>
                    <SelectContent>{LINKEDIN_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Message Body</Label>
                  <Textarea value={form.body} onChange={e => set('body', e.target.value)} rows={3} placeholder="LinkedIn message content..." />
                </div>
              </>
            )}

            {form.communication_type === 'Email' && (
              <div>
                <Label>Email Body</Label>
                <Textarea value={form.body} onChange={e => set('body', e.target.value)} rows={3} placeholder="Email body content..." />
              </div>
            )}

            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" onClick={() => setLogOpen(false)}>Cancel</Button>
            <Button onClick={handleLog}>Log</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
