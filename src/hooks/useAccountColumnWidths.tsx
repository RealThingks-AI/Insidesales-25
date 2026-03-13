import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const defaultColumnWidths: Record<string, number> = {
  checkbox: 48,
  account_name: 300,
  linked_contacts: 100,
  status: 100,
  company_type: 120,
  industry: 120,
  phone: 120,
  website: 150,
  country: 100,
  region: 80,
  currency: 80,
  created_time: 100,
  account_owner: 130,
  actions: 80,
};

export function useAccountColumnWidths() {
  const { user } = useAuth();
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(defaultColumnWidths);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) { 
      setIsLoading(false); 
      return; 
    }
    
    const loadPreferences = async () => {
      try {
        const { data } = await supabase
          .from('column_preferences')
          .select('column_widths')
          .eq('user_id', user.id)
          .eq('module', 'accounts_widths')
          .maybeSingle();
        
        if (data?.column_widths) {
          setColumnWidths({ ...defaultColumnWidths, ...(data.column_widths as Record<string, number>) });
        }
      } catch (error) {
        console.error('Error loading account column widths:', error);
      } finally { 
        setIsLoading(false); 
      }
    };
    loadPreferences();
  }, [user]);

  const updateColumnWidth = useCallback(async (field: string, width: number) => {
    const newWidths = { ...columnWidths, [field]: width };
    setColumnWidths(newWidths);
    
    if (!user) return;
    
    try {
      await supabase.from('column_preferences').upsert({
        user_id: user.id,
        module: 'accounts_widths',
        column_widths: newWidths,
      }, { onConflict: 'user_id,module' });
    } catch (error) {
      console.error('Error saving account column widths:', error);
    }
  }, [user, columnWidths]);

  return { columnWidths, isLoading, updateColumnWidth, defaultColumnWidths };
}
