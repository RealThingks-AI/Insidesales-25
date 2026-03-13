import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DealColumnConfig } from '@/components/DealColumnCustomizer';

const defaultColumnWidths: Record<string, number> = {
  'project_name': 200,
  'customer_name': 150,
  'lead_name': 150,
  'lead_owner': 140,
  'stage': 120,
  'priority': 100,
  'total_contract_value': 120,
  'probability': 120,
  'expected_closing_date': 140,
  'region': 120,
  'project_duration': 120,
  'start_date': 120,
  'end_date': 120,
  'proposal_due_date': 140,
  'total_revenue': 120,
};

const defaultColumns: DealColumnConfig[] = [
  { field: 'project_name', label: 'Project', visible: true, order: 0 },
  { field: 'customer_name', label: 'Customer', visible: true, order: 1 },
  { field: 'lead_name', label: 'Lead Name', visible: true, order: 2 },
  { field: 'lead_owner', label: 'Lead Owner', visible: true, order: 3 },
  { field: 'stage', label: 'Stage', visible: true, order: 4 },
  { field: 'priority', label: 'Priority', visible: true, order: 5 },
  { field: 'total_contract_value', label: 'Value', visible: true, order: 6 },
  { field: 'probability', label: 'Probability', visible: true, order: 7 },
  { field: 'expected_closing_date', label: 'Expected Close', visible: true, order: 8 },
  { field: 'region', label: 'Region', visible: false, order: 9 },
  { field: 'project_duration', label: 'Duration', visible: false, order: 10 },
  { field: 'start_date', label: 'Start Date', visible: false, order: 11 },
  { field: 'end_date', label: 'End Date', visible: false, order: 12 },
  { field: 'proposal_due_date', label: 'Proposal Due', visible: false, order: 13 },
  { field: 'total_revenue', label: 'Total Revenue', visible: false, order: 14 },
];

const MODULE_NAME = 'deals';

interface ColumnPreferencesData {
  widths: Record<string, number>;
  visibility: Array<{ field: string; visible: boolean; order: number }>;
}

export function useDealsColumnPreferences() {
  const { user } = useAuth();
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(defaultColumnWidths);
  const [columns, setColumns] = useState<DealColumnConfig[]>(defaultColumns);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load column preferences from database
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const loadPreferences = async () => {
      try {
        const { data, error } = await supabase
          .from('column_preferences')
          .select('column_widths')
          .eq('user_id', user.id)
          .eq('module', MODULE_NAME)
          .maybeSingle();

        if (error) {
          console.error('Failed to load deals column preferences:', error);
          // Fall back to localStorage
          const savedWidths = localStorage.getItem(`deals-column-widths-${user.id}`);
          if (savedWidths) {
            const parsed = JSON.parse(savedWidths);
            setColumnWidths({ ...defaultColumnWidths, ...parsed });
          }
        } else if (data?.column_widths) {
          const prefs = data.column_widths as unknown as ColumnPreferencesData;
          
          // Load widths
          if (prefs.widths) {
            setColumnWidths({ ...defaultColumnWidths, ...prefs.widths });
          } else {
            // Legacy format - just widths directly
            setColumnWidths({ ...defaultColumnWidths, ...(data.column_widths as Record<string, number>) });
          }
          
          // Load column visibility/order
          if (prefs.visibility && Array.isArray(prefs.visibility)) {
            const updatedColumns = defaultColumns.map(col => {
              const saved = prefs.visibility.find(v => v.field === col.field);
              if (saved) {
                return { ...col, visible: saved.visible, order: saved.order };
              }
              return col;
            });
            setColumns(updatedColumns.sort((a, b) => a.order - b.order));
          }
        }
      } catch (error) {
        console.error('Failed to load deals column preferences:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, [user]);

  // Save column widths to database
  const saveColumnWidths = useCallback(async (newWidths: Record<string, number>) => {
    if (!user) return;

    setColumnWidths(newWidths);
    setIsSaving(true);

    try {
      // Get existing visibility data
      const visibility = columns.map(col => ({
        field: col.field,
        visible: col.visible,
        order: col.order,
      }));

      const prefs: ColumnPreferencesData = {
        widths: newWidths,
        visibility,
      };

      const { error } = await supabase
        .from('column_preferences')
        .upsert(
          {
            user_id: user.id,
            module: MODULE_NAME,
            column_widths: prefs as unknown as Record<string, number>,
          },
          {
            onConflict: 'user_id,module',
          }
        );

      if (error) {
        console.error('Failed to save deals column widths to DB:', error);
        // Fall back to localStorage
        localStorage.setItem(
          `deals-column-widths-${user.id}`,
          JSON.stringify(newWidths)
        );
      }
    } catch (error) {
      console.error('Failed to save deals column widths:', error);
      // Fall back to localStorage
      localStorage.setItem(
        `deals-column-widths-${user.id}`,
        JSON.stringify(newWidths)
      );
    } finally {
      setIsSaving(false);
    }
  }, [user, columns]);

  // Save column visibility and order to database
  const saveColumns = useCallback(async (newColumns: DealColumnConfig[]) => {
    if (!user) return;

    setColumns(newColumns);
    setIsSaving(true);

    try {
      const visibility = newColumns.map(col => ({
        field: col.field,
        visible: col.visible,
        order: col.order,
      }));

      const prefs: ColumnPreferencesData = {
        widths: columnWidths,
        visibility,
      };

      const { error } = await supabase
        .from('column_preferences')
        .upsert(
          {
            user_id: user.id,
            module: MODULE_NAME,
            column_widths: prefs as unknown as Record<string, number>,
          },
          {
            onConflict: 'user_id,module',
          }
        );

      if (error) {
        console.error('Failed to save deals column visibility to DB:', error);
      }
    } catch (error) {
      console.error('Failed to save deals column visibility:', error);
    } finally {
      setIsSaving(false);
    }
  }, [user, columnWidths]);

  // Update a single column width
  const updateColumnWidth = useCallback((field: string, width: number) => {
    const newWidths = { ...columnWidths, [field]: width };
    saveColumnWidths(newWidths);
  }, [columnWidths, saveColumnWidths]);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setColumns(defaultColumns);
    saveColumnWidths(defaultColumnWidths);
  }, [saveColumnWidths]);

  return {
    columnWidths,
    columns,
    isLoading,
    isSaving,
    updateColumnWidth,
    saveColumnWidths,
    saveColumns,
    resetToDefaults,
    defaultColumnWidths,
    defaultColumns,
  };
}
