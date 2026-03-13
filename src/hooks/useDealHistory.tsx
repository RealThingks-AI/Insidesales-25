import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DealAuditLog {
  id: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
  user_id: string | null;
  resource_type: string;
  resource_id: string | null;
}

interface DealActionItem {
  id: string;
  next_action: string;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
  created_at: string;
  created_by: string | null;
  deal_id: string;
}

export const useDealHistory = (dealId: string | null) => {
  const queryClient = useQueryClient();

  // Fetch audit logs for the deal
  const { data: auditLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['deal-audit-logs', dealId],
    queryFn: async () => {
      if (!dealId) return [];
      
      const { data, error } = await supabase
        .from('security_audit_log')
        .select('*')
        .eq('resource_type', 'deals')
        .eq('resource_id', dealId)
        .order('created_at', { ascending: true })
        .limit(50);
      
      if (error) {
        console.error('Error fetching deal audit logs:', error);
        return [];
      }
      
      return (data || []) as DealAuditLog[];
    },
    enabled: !!dealId,
  });

  // Fetch action items for the deal
  const { data: actionItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['deal-action-items', dealId],
    queryFn: async () => {
      if (!dealId) return [];
      
      const { data, error } = await supabase
        .from('deal_action_items')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching deal action items:', error);
        return [];
      }
      
      return (data || []) as DealActionItem[];
    },
    enabled: !!dealId,
  });

  // Mark action item as complete
  const completeActionItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('deal_action_items')
        .update({ status: 'Completed' })
        .eq('id', itemId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-action-items', dealId] });
      queryClient.invalidateQueries({ queryKey: ['deal-audit-logs', dealId] });
    },
  });

  // Add new action item
  const addActionItem = useMutation({
    mutationFn: async ({ action, dueDate }: { action: string; dueDate?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('deal_action_items')
        .insert({
          deal_id: dealId!,
          next_action: action,
          due_date: dueDate || null,
          created_by: user?.id || null,
          status: 'Open',
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-action-items', dealId] });
    },
  });

  // Filter active vs completed action items
  const activeActionItems = actionItems.filter(item => item.status !== 'Completed');
  const completedActionItems = actionItems.filter(item => item.status === 'Completed');

  return {
    auditLogs,
    activeActionItems,
    completedActionItems,
    allActionItems: actionItems,
    isLoading: logsLoading || itemsLoading,
    completeActionItem: completeActionItem.mutate,
    addActionItem: addActionItem.mutate,
    isCompleting: completeActionItem.isPending,
    isAdding: addActionItem.isPending,
  };
};
