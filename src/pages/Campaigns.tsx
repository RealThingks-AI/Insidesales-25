import { useState } from 'react';
import { useCampaigns } from '@/hooks/useCampaigns';
import { CampaignList } from '@/components/campaigns/CampaignList';
import { CampaignModal } from '@/components/campaigns/CampaignModal';
import { CampaignDetailPanel } from '@/components/campaigns/CampaignDetailPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Megaphone } from 'lucide-react';
import { CAMPAIGN_STATUSES, CAMPAIGN_TYPES } from '@/types/campaign';
import type { Campaign } from '@/types/campaign';
import { useUserDisplayNames } from '@/hooks/useUserDisplayNames';
import { useAuth } from '@/hooks/useAuth';

export default function Campaigns() {
  const { campaignsQuery, deleteCampaign } = useCampaigns();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  const campaigns = campaignsQuery.data ?? [];

  // Collect unique owner IDs for display name resolution
  const ownerIds = [...new Set(campaigns.map(c => c.owner).filter(Boolean) as string[])];
  const { displayNames } = useUserDisplayNames(ownerIds);

  const filtered = campaigns.filter(c => {
    const matchSearch = c.campaign_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchType = typeFilter === 'all' || c.campaign_type === typeFilter;
    const matchOwner = ownerFilter === 'all' || c.owner === ownerFilter;
    return matchSearch && matchStatus && matchType && matchOwner;
  });

  const handleEdit = (campaign: Campaign) => {
    setEditCampaign(campaign);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteCampaign.mutate(id);
    if (selectedCampaign?.id === id) setSelectedCampaign(null);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">Campaigns</h1>
          <span className="text-sm text-muted-foreground ml-2">({filtered.length})</span>
        </div>
        <Button size="sm" onClick={() => { setEditCampaign(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> New Campaign
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {CAMPAIGN_STATUSES.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {CAMPAIGN_TYPES.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {ownerIds.length > 0 && (
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Owner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Owners</SelectItem>
              {ownerIds.map(id => (
                <SelectItem key={id} value={id}>{displayNames[id] || id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className={`${selectedCampaign ? 'w-1/2' : 'w-full'} overflow-auto transition-all`}>
          <CampaignList
            campaigns={filtered}
            loading={campaignsQuery.isLoading}
            onSelect={setSelectedCampaign}
            onEdit={handleEdit}
            onDelete={handleDelete}
            selectedId={selectedCampaign?.id}
          />
        </div>
        {selectedCampaign && (
          <div className="w-1/2 border-l border-border overflow-hidden">
            <CampaignDetailPanel
              campaign={selectedCampaign}
              onClose={() => setSelectedCampaign(null)}
              onEdit={() => handleEdit(selectedCampaign)}
            />
          </div>
        )}
      </div>

      <CampaignModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        campaign={editCampaign}
      />
    </div>
  );
}
