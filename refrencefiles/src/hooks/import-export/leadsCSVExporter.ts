
import { supabase } from '@/integrations/supabase/client';
import { UserNameUtils } from '@/utils/userNameUtils';

export class LeadsCSVExporter {
  async exportLeads(leads: any[]): Promise<string> {
    console.log('LeadsCSVExporter: Starting export of', leads.length, 'leads');
    
    // Define the exact field order as required - matches DB schema
    const fieldOrder = [
      'id',
      'lead_name', 
      'company_name',
      'position',
      'email',
      'phone_no',
      'linkedin',
      'website',
      'contact_source',
      'lead_status',
      'industry',
      'country',
      'description',
      'account_id',
      'contact_owner',
      'created_by',
      'modified_by',
      'created_time',
      'modified_time'
    ];

    // Fetch user display names for all user fields
    const userIds = UserNameUtils.extractUserIds(leads, ['contact_owner', 'created_by', 'modified_by']);
    const userNameMap = await UserNameUtils.fetchUserDisplayNames(userIds);
    console.log('LeadsCSVExporter: Fetched display names for', Object.keys(userNameMap).length, 'users');

    const csvRows = [];
    
    // Add headers in exact order
    csvRows.push(fieldOrder.join(','));

    // Process each lead
    for (const lead of leads) {
      // Create row with values in exact field order
      const rowValues = fieldOrder.map(field => {
        let value = lead[field];

        // Format ID (shortened)
        if (field === 'id' && value) {
          return UserNameUtils.formatIdForExport(value);
        }

        // Convert UUID to display name for user fields
        if (UserNameUtils.isUserField(field) && value) {
          const displayName = userNameMap[value] || '';
          return this.escapeCSVValue(displayName);
        }

        // Format datetime fields
        if (UserNameUtils.isDateTimeField(field) && value) {
          return this.escapeCSVValue(UserNameUtils.formatDateTimeForExport(value));
        }

        // Handle null/undefined values
        if (value === null || value === undefined) {
          return '';
        }

        return this.escapeCSVValue(String(value));
      });

      csvRows.push(rowValues.join(','));
    }

    const csvContent = csvRows.join('\n');
    console.log('LeadsCSVExporter: Export completed');
    return csvContent;
  }

  private escapeCSVValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
