import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ActionItemColumnConfig {
  field: string;
  label: string;
  visible: boolean;
  order: number;
  width: number;
}

const defaultColumnWidths: Record<string, number> = {
  checkbox: 48,
  title: 300,
  assigned_to: 100,
  due_date: 100,
  status: 36,
  priority: 36,
  module: 36,
  actions: 60,
};

const MODULE_NAME = 'action_items';

export function useActionItemColumnPreferences() {
  const { user } = useAuth();
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(defaultColumnWidths);
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
          console.error('Failed to load column preferences:', error);
          // Fall back to localStorage
          const savedWidths = localStorage.getItem(`action-items-column-widths-${user.id}`);
          if (savedWidths) {
            const parsed = JSON.parse(savedWidths);
            setColumnWidths({ ...defaultColumnWidths, ...parsed });
          }
        } else if (data?.column_widths) {
          setColumnWidths({ ...defaultColumnWidths, ...(data.column_widths as Record<string, number>) });
        }
      } catch (error) {
        console.error('Failed to load column preferences:', error);
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
      const { error } = await supabase
        .from('column_preferences')
        .upsert(
          {
            user_id: user.id,
            module: MODULE_NAME,
            column_widths: newWidths,
          },
          {
            onConflict: 'user_id,module',
          }
        );

      if (error) {
        console.error('Failed to save column widths to DB:', error);
        // Fall back to localStorage
        localStorage.setItem(
          `action-items-column-widths-${user.id}`,
          JSON.stringify(newWidths)
        );
      }
    } catch (error) {
      console.error('Failed to save column widths:', error);
      // Fall back to localStorage
      localStorage.setItem(
        `action-items-column-widths-${user.id}`,
        JSON.stringify(newWidths)
      );
    } finally {
      setIsSaving(false);
    }
  }, [user]);

  // Update a single column width
  const updateColumnWidth = useCallback((field: string, width: number) => {
    const newWidths = { ...columnWidths, [field]: width };
    saveColumnWidths(newWidths);
  }, [columnWidths, saveColumnWidths]);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    saveColumnWidths(defaultColumnWidths);
  }, [saveColumnWidths]);

  return {
    columnWidths,
    isLoading,
    isSaving,
    updateColumnWidth,
    saveColumnWidths,
    resetToDefaults,
  };
}
