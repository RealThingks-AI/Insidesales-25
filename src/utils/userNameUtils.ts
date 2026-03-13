
import { supabase } from '@/integrations/supabase/client';

const USER_FIELDS = [
  'contact_owner', 'created_by', 'modified_by', 'lead_owner',
  'account_owner', 'assigned_to', 'created_by'
];

const DATETIME_FIELDS = [
  'created_at', 'modified_at', 'created_time', 'modified_time', 'last_activity_time'
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class UserNameUtils {

  static isUserField(field: string): boolean {
    return USER_FIELDS.includes(field);
  }

  static isDateTimeField(field: string): boolean {
    return DATETIME_FIELDS.includes(field);
  }

  static extractUserIds(data: any[], fields?: string[]): string[] {
    const fieldsToCheck = fields || USER_FIELDS;
    const ids = new Set<string>();
    for (const record of data) {
      for (const field of fieldsToCheck) {
        const value = record[field];
        if (value && typeof value === 'string' && UUID_REGEX.test(value)) {
          ids.add(value);
        }
      }
    }
    return Array.from(ids);
  }

  static async fetchUserDisplayNames(userIds: string[]): Promise<Record<string, string>> {
    if (!userIds || userIds.length === 0) return {};
    try {
      const { data, error } = await supabase.functions.invoke('fetch-user-display-names', {
        body: { userIds },
      });
      if (error) {
        console.error('UserNameUtils: Error fetching display names:', error);
        return {};
      }
      return data?.userDisplayNames || {};
    } catch (err) {
      console.error('UserNameUtils: Failed to fetch display names:', err);
      return {};
    }
  }

  static formatIdForExport(id: string): string {
    if (!id) return '';
    return id.substring(0, 8);
  }

  static formatDateTimeForExport(value: any): string {
    if (!value) return '';
    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) return '';
      const y = date.getFullYear();
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      const d = date.getDate().toString().padStart(2, '0');
      const h = date.getHours().toString().padStart(2, '0');
      const min = date.getMinutes().toString().padStart(2, '0');
      const s = date.getSeconds().toString().padStart(2, '0');
      return `${y}-${m}-${d} ${h}:${min}:${s}`;
    } catch {
      return '';
    }
  }
}
