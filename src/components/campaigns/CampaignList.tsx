import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { MoreHorizontal, Pencil, Trash2, Copy } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useCampaignAggregates, useCampaigns } from '@/hooks/useCampaigns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Campaign } from '@/types/campaign';
import { format } from 'date-fns';

interface CampaignListProps {
  campaigns: Campaign[];
  loading: boolean;
  onSelect: (campaign: Campaign) => void;
  onEdit: (campaign: Campaign) => void;
  onDelete: (id: string) => void;
  selectedId?: string;
}

const statusColors: Record<string, string> = {
  Draft: 'bg-muted text-muted-foreground',
  Active: 'bg-primary/10 text-primary',
  Paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  Completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  Cancelled: 'bg-destructive/10 text-destructive',
};

export function CampaignList({ campaigns, loading, onSelect, onEdit, onDelete, selectedId }: CampaignListProps) {
  const aggregatesQuery = useCampaignAggregates();
  const aggregates = aggregatesQuery.data || {};
  const { cloneCampaign } = useCampaigns();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Fetch owner names
  const ownerIds = [...new Set(campaigns.map(c => c.owner).filter(Boolean))] as string[];
  const ownersQuery = useQuery({
    queryKey: ['campaign_owners', ownerIds],
    queryFn: async () => {
      if (!ownerIds.length) return {};
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', ownerIds);
      const map: Record<string, string> = {};
      (data || []).forEach(p => { map[p.id] = p.full_name || 'Unnamed'; });
      return map;
    },
    enabled: ownerIds.length > 0,
  });
  const ownerNames = ownersQuery.data || {};

  // Fetch deals won per campaign
  const dealsWonQuery = useQuery({
    queryKey: ['campaign_deals_won'],
    queryFn: async () => {
      const { data } = await supabase
        .from('deals')
        .select('campaign_id')
        .not('campaign_id', 'is', null)
        .eq('stage', 'Won');
      const counts: Record<string, number> = {};
      (data || []).forEach((d: any) => {
        counts[d.campaign_id] = (counts[d.campaign_id] || 0) + 1;
      });
      return counts;
    },
  });
  const dealsWon = dealsWonQuery.data || {};

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!campaigns.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p className="text-sm">No campaigns found</p>
        <p className="text-xs mt-1">Create your first campaign to get started</p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Campaign Name</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Start Date</TableHead>
            <TableHead>End Date</TableHead>
            <TableHead className="text-center">Accounts</TableHead>
            <TableHead className="text-center">Contacts</TableHead>
            <TableHead className="text-center">Deals</TableHead>
            <TableHead className="text-center">Won</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map(c => {
            const agg = aggregates[c.id];
            return (
              <TableRow
                key={c.id}
                className={`cursor-pointer ${selectedId === c.id ? 'bg-accent' : ''}`}
                onClick={() => onSelect(c)}
              >
                <TableCell className="font-medium">{c.campaign_name}</TableCell>
                <TableCell className="text-sm">{c.owner ? (ownerNames[c.owner] || '—') : '—'}</TableCell>
                <TableCell className="text-sm">{c.campaign_type || '—'}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusColors[c.status] || ''}>
                    {c.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{c.start_date ? format(new Date(c.start_date), 'dd MMM yyyy') : '—'}</TableCell>
                <TableCell className="text-sm">{c.end_date ? format(new Date(c.end_date), 'dd MMM yyyy') : '—'}</TableCell>
                <TableCell className="text-center text-sm">{agg?.accounts ?? 0}</TableCell>
                <TableCell className="text-center text-sm">{agg?.contacts ?? 0}</TableCell>
                <TableCell className="text-center text-sm">{agg?.deals ?? 0}</TableCell>
                <TableCell className="text-center text-sm">
                  {dealsWon[c.id] ? (
                    <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      {dealsWon[c.id]}
                    </Badge>
                  ) : '0'}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={e => { e.stopPropagation(); onEdit(c); }}>
                        <Pencil className="h-4 w-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={e => { e.stopPropagation(); cloneCampaign.mutate(c); }} disabled={cloneCampaign.isPending}>
                        <Copy className="h-4 w-4 mr-2" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={e => { e.stopPropagation(); setDeleteId(c.id); }} className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <AlertDialog open={!!deleteId} onOpenChange={o => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this campaign? All associated accounts, contacts, communications, templates, scripts, and materials will also be deleted. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) { onDelete(deleteId); setDeleteId(null); } }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
