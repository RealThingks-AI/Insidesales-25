import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCampaignAccounts, useCampaignContacts, useCampaignCommunications } from '@/hooks/useCampaigns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, Mail, Phone, Linkedin, BarChart3, Trophy, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface Props {
  campaignId: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function CampaignAnalytics({ campaignId }: Props) {
  const accounts = useCampaignAccounts(campaignId);
  const contacts = useCampaignContacts(campaignId);
  const comms = useCampaignCommunications(campaignId);

  const accountsData = accounts.query.data || [];
  const contactsData = contacts.query.data || [];
  const commsData = comms.query.data || [];

  // Query deals linked to this campaign
  const dealsQuery = useQuery({
    queryKey: ['campaign_deals', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('id, stage')
        .eq('campaign_id', campaignId);
      if (error) throw error;
      return data || [];
    },
  });

  const dealsData = dealsQuery.data || [];

  const emailsSent = commsData.filter(c => c.communication_type === 'Email').length;
  const callsMade = commsData.filter(c => c.communication_type === 'Phone').length;
  const linkedinSent = commsData.filter(c => c.communication_type === 'LinkedIn').length;
  const meetingsScheduled = commsData.filter(c => c.communication_type === 'Meeting').length;
  const responded = contactsData.filter(c => c.stage === 'Responded' || c.stage === 'Qualified').length;
  const dealsCreated = dealsData.length;
  const dealsWon = dealsData.filter(d => d.stage === 'Won').length;

  const stats = [
    { label: 'Accounts Targeted', value: accountsData.length, icon: Building2 },
    { label: 'Contacts Targeted', value: contactsData.length, icon: Users },
    { label: 'Emails Sent', value: emailsSent, icon: Mail },
    { label: 'Calls Made', value: callsMade, icon: Phone },
    { label: 'LinkedIn Messages', value: linkedinSent, icon: Linkedin },
    { label: 'Meetings Scheduled', value: meetingsScheduled, icon: Calendar },
    { label: 'Responses', value: responded, icon: BarChart3 },
    { label: 'Deals Created', value: dealsCreated, icon: BarChart3 },
    { label: 'Deals Won', value: dealsWon, icon: Trophy },
  ];

  const responseRate = contactsData.length > 0 ? ((responded / contactsData.length) * 100).toFixed(1) : '0';

  // Funnel data
  const contacted = contactsData.filter(c => c.stage !== 'Not Contacted').length;
  const qualified = contactsData.filter(c => c.stage === 'Qualified').length;
  const funnelData = [
    { name: 'Targeted', value: contactsData.length },
    { name: 'Contacted', value: contacted },
    { name: 'Responded', value: responded },
    { name: 'Qualified', value: qualified },
    { name: 'Deal Created', value: dealsCreated },
    { name: 'Deal Won', value: dealsWon },
  ];

  // Communication type breakdown
  const commTypes = ['Email', 'Phone', 'LinkedIn', 'Meeting', 'Follow Up'];
  const pieData = commTypes
    .map(type => ({ name: type, value: commsData.filter(c => c.communication_type === type).length }))
    .filter(d => d.value > 0);

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-3">
        {stats.map(s => (
          <Card key={s.label} className="border-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <s.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Outreach Funnel */}
      <Card className="border-border">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Outreach Funnel</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={funnelData} layout="vertical" margin={{ left: 20, right: 20 }}>
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Communication Type Breakdown */}
      {pieData.length > 0 && (
        <Card className="border-border">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Communication Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card className="border-border">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Summary</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Response Rate</span>
            <span className="font-medium text-foreground">{responseRate}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Deals Created</span>
            <span className="font-medium text-foreground">{dealsCreated}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Deals Won</span>
            <span className="font-medium text-foreground">{dealsWon}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Meetings Scheduled</span>
            <span className="font-medium text-foreground">{meetingsScheduled}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Communications</span>
            <span className="font-medium text-foreground">{commsData.length}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
