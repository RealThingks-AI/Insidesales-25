
import { supabase } from '@/integrations/supabase/client';
import { CSVParser } from '@/utils/csvParser';
import { DateFormatUtils } from '@/utils/dateFormatUtils';
import { UserNameUtils } from '@/utils/userNameUtils';

export interface LeadsProcessingOptions {
  userId: string;
  onProgress?: (processed: number, total: number) => void;
}

export interface LeadsProcessingResult {
  successCount: number;
  updateCount: number;
  errorCount: number;
  errors: string[];
}

export class LeadsCSVProcessor {
  private userIdMap: Record<string, string> = {};

  async processCSV(csvText: string, options: LeadsProcessingOptions): Promise<LeadsProcessingResult> {
    console.log('LeadsCSVProcessor: Starting processing');
    
    try {
      const { headers, rows } = CSVParser.parseCSV(csvText);
      console.log(`LeadsCSVProcessor: Parsed ${rows.length} rows with headers:`, headers);

      if (rows.length === 0) {
        throw new Error('No data rows found in CSV');
      }

      // Collect user names from CSV for user fields
      const userNames = UserNameUtils.extractUserNames(rows, headers, ['contact_owner', 'created_by', 'modified_by']);
      this.userIdMap = await UserNameUtils.fetchUserIdsByNames(userNames);
      console.log('LeadsCSVProcessor: Fetched user IDs for', Object.keys(this.userIdMap).length, 'users');

      const result: LeadsProcessingResult = {
        successCount: 0,
        updateCount: 0,
        errorCount: 0,
        errors: []
      };

      // Process rows in batches
      const batchSize = 20;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const batchResult = await this.processBatch(batch, headers, options);
        
        result.successCount += batchResult.successCount;
        result.updateCount += batchResult.updateCount;
        result.errorCount += batchResult.errorCount;
        result.errors.push(...batchResult.errors);

        if (options.onProgress) {
          options.onProgress(Math.min(i + batchSize, rows.length), rows.length);
        }
      }

      console.log('LeadsCSVProcessor: Processing complete:', result);
      return result;

    } catch (error: any) {
      console.error('LeadsCSVProcessor: Processing failed:', error);
      throw new Error(`CSV processing failed: ${error.message}`);
    }
  }

  private async processBatch(
    rows: string[][],
    headers: string[],
    options: LeadsProcessingOptions
  ): Promise<LeadsProcessingResult> {
    
    const result: LeadsProcessingResult = {
      successCount: 0,
      updateCount: 0,
      errorCount: 0,
      errors: []
    };

    for (const row of rows) {
      try {
        // Convert row to object
        const rowObj: Record<string, any> = {};
        headers.forEach((header, index) => {
          if (row[index] !== undefined) {
            rowObj[header] = row[index];
          }
        });

        // Prepare lead record (action_items_json is now ignored if present)
        delete rowObj.action_items_json; // Remove if present in old exports
        const leadRecord = this.prepareLead(rowObj, options.userId);

        // Validate required fields - ensure lead_name is present and not empty
        if (!leadRecord.lead_name || leadRecord.lead_name.trim() === '') {
          result.errorCount++;
          result.errors.push('Lead name is required');
          continue;
        }

        let leadId: string;

        // Check for existing lead by ID only (as per requirements)
        if (rowObj.id && rowObj.id.trim() !== '') {
          console.log('Checking for existing lead with ID:', rowObj.id);
          const { data: existingLead } = await supabase
            .from('leads')
            .select('id')
            .eq('id', rowObj.id.trim())
            .single();

          if (existingLead) {
            // Update existing lead
            leadId = existingLead.id;
            const { error: updateError } = await supabase
              .from('leads')
              .update(leadRecord)
              .eq('id', leadId);

            if (updateError) {
              result.errorCount++;
              result.errors.push(`Update failed: ${updateError.message}`);
              continue;
            }
            result.updateCount++;
            console.log('Updated existing lead:', leadId);
          } else {
            // Insert new lead with provided ID - ensure all required fields are present
            const leadToInsert = {
              id: rowObj.id.trim(),
              lead_name: leadRecord.lead_name, // Ensure lead_name is explicitly included
              ...leadRecord
            };

            const { data: insertedLead, error: insertError } = await supabase
              .from('leads')
              .insert([leadToInsert])
              .select('id')
              .single();

            if (insertError) {
              result.errorCount++;
              result.errors.push(`Insert failed: ${insertError.message}`);
              continue;
            }
            leadId = insertedLead.id;
            result.successCount++;
            console.log('Inserted new lead with ID:', leadId);
          }
        } else {
          // Insert new lead without ID (let database generate it) - ensure all required fields are present
          const leadToInsert = {
            lead_name: leadRecord.lead_name, // Ensure lead_name is explicitly included
            ...leadRecord
          };

          const { data: insertedLead, error: insertError } = await supabase
            .from('leads')
            .insert([leadToInsert])
            .select('id')
            .single();

          if (insertError) {
            result.errorCount++;
            result.errors.push(`Insert failed: ${insertError.message}`);
            continue;
          }
          leadId = insertedLead.id;
          result.successCount++;
          console.log('Inserted new lead without ID:', leadId);
        }

      } catch (error: any) {
        result.errorCount++;
        result.errors.push(`Row processing error: ${error.message}`);
      }
    }

    return result;
  }

  private prepareLead(rowObj: Record<string, any>, userId: string): Record<string, any> {
    const leadRecord: Record<string, any> = {
      modified_by: userId
    };

    // If this is a new record (no existing ID), set created_by
    if (!rowObj.id || rowObj.id.trim() === '') {
      leadRecord.created_by = userId;
    }

    // Map CSV fields to database fields in exact order - Added account_id
    const fieldMapping: Record<string, string> = {
      'lead_name': 'lead_name',
      'company_name': 'company_name',
      'position': 'position',
      'email': 'email',
      'phone_no': 'phone_no',
      'linkedin': 'linkedin',
      'website': 'website',
      'contact_source': 'contact_source',
      'lead_status': 'lead_status',
      'industry': 'industry',
      'country': 'country',
      'description': 'description',
      'account_id': 'account_id'
    };

    Object.entries(fieldMapping).forEach(([csvField, dbField]) => {
      if (rowObj[csvField] !== undefined && rowObj[csvField] !== '') {
        leadRecord[dbField] = rowObj[csvField];
      }
    });

    // Handle user fields - convert display names to UUIDs
    if (rowObj.contact_owner !== undefined && rowObj.contact_owner !== '') {
      leadRecord.contact_owner = UserNameUtils.resolveUserId(rowObj.contact_owner, this.userIdMap, userId);
    }
    if (rowObj.created_by !== undefined && rowObj.created_by !== '') {
      leadRecord.created_by = UserNameUtils.resolveUserId(rowObj.created_by, this.userIdMap, userId);
    }
    if (rowObj.modified_by !== undefined && rowObj.modified_by !== '') {
      leadRecord.modified_by = UserNameUtils.resolveUserId(rowObj.modified_by, this.userIdMap, userId);
    }

    // Ensure lead_name is always set
    if (!leadRecord.lead_name) {
      leadRecord.lead_name = rowObj.name || rowObj.contact_name || rowObj.full_name || '';
    }

    // Handle date fields
    if (rowObj.created_time) {
      const convertedDate = DateFormatUtils.convertDateForImport(rowObj.created_time);
      if (convertedDate) leadRecord.created_time = convertedDate;
    }

    if (rowObj.modified_time) {
      const convertedDate = DateFormatUtils.convertDateForImport(rowObj.modified_time);
      if (convertedDate) leadRecord.modified_time = convertedDate;
    }

    return leadRecord;
  }
}
