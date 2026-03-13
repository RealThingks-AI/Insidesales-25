import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ColumnConfig {
  field: string;
  label: string;
  visible: boolean;
  order: number;
}

interface ColumnPreferencesData {
  visibility: Array<{ field: string; visible: boolean; order: number }>;
}

/**
 * Generic hook to persist column visibility/order preferences per user per module.
 * Works with Accounts, Contacts, Leads, and any future module.
 */
export function useColumnPreferences<T extends ColumnConfig>(
  moduleName: string,
  defaultColumns: T[]
) {
  const { user } = useAuth();
  const [columns, setColumnsState] = useState<T[]>(defaultColumns);
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences on mount
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
          .eq('module', moduleName)
          .maybeSingle();

        if (!error && data?.column_widths) {
          const prefs = data.column_widths as unknown as ColumnPreferencesData;

          if (prefs.visibility && Array.isArray(prefs.visibility)) {
            const updatedColumns = defaultColumns.map((col) => {
              const saved = prefs.visibility.find((v) => v.field === col.field);
              if (saved) {
                return { ...col, visible: saved.visible, order: saved.order };
              }
              return col;
            }) as T[];
            setColumnsState(updatedColumns.sort((a, b) => a.order - b.order));
          }
        }
      } catch (error) {
        console.error(`Failed to load ${moduleName} column preferences:`, error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, [user, moduleName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save + update columns
  const setColumns = useCallback(
    async (newColumns: T[]) => {
      setColumnsState(newColumns);

      if (!user) return;

      try {
        const visibility = newColumns.map((col) => ({
          field: col.field,
          visible: col.visible,
          order: col.order,
        }));

        const prefs: ColumnPreferencesData = { visibility };

        const { error } = await supabase.from('column_preferences').upsert(
          {
            user_id: user.id,
            module: moduleName,
            column_widths: prefs as unknown as Record<string, number>,
          },
          { onConflict: 'user_id,module' }
        );

        if (error) {
          console.error(`Failed to save ${moduleName} column preferences:`, error);
        }
      } catch (error) {
        console.error(`Failed to save ${moduleName} column preferences:`, error);
      }
    },
    [user, moduleName]
  );

  return { columns, setColumns, isLoading };
}
