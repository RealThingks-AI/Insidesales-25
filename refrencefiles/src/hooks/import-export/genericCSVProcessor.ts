
import { supabase } from '@/integrations/supabase/client';
import { CSVParser } from '@/utils/csvParser';
import { createHeaderMapper } from './headerMapper';
import { createRecordValidator } from './recordValidator';
import { createDuplicateChecker } from './duplicateChecker';
import { LeadsCSVProcessor } from './leadsCSVProcessor';
import { DateFormatUtils } from '@/utils/dateFormatUtils';
import { UserNameUtils } from '@/utils/userNameUtils';

export interface ProcessingOptions {
  tableName: string;
  userId: string;
  onProgress?: (processed: number, total: number) => void;
}

export interface ProcessingResult {
  successCount: number;
  updateCount: number;
  duplicateCount: number;
  errorCount: number;
  errors: string[];
}

export class GenericCSVProcessor {
  async processCSV(csvText: string, options: ProcessingOptions): Promise<ProcessingResult> {
    console.log(`GenericCSVProcessor: Starting processing for table ${options.tableName}`);
    
    // Use specialized processor for leads
    if (options.tableName === 'leads') {
      const leadsProcessor = new LeadsCSVProcessor();
      const result = await leadsProcessor.processCSV(csvText, {
        userId: options.userId,
        onProgress: options.onProgress
      });
      
      // Convert LeadsProcessingResult to ProcessingResult format
      return {
        successCount: result.successCount,
        updateCount: result.updateCount,
        duplicateCount: 0, // Not used in leads processor
        errorCount: result.errorCount,
        errors: result.errors
      };
    }

    
    try {
      // Parse CSV
      const { headers, rows } = CSVParser.parseCSV(csvText);
      console.log(`GenericCSVProcessor: Parsed ${rows.length} rows with headers:`, headers);

      if (rows.length === 0) {
        throw new Error('No data rows found in CSV');
      }

      // Map headers to database columns
      const headerMapper = createHeaderMapper(options.tableName);
      const columnMap: Record<string, string> = {};
      headers.forEach(header => {
        const mappedColumn = headerMapper(header);
        if (mappedColumn) {
          columnMap[header] = mappedColumn;
        }
      });
      console.log('GenericCSVProcessor: Column mapping:', columnMap);

      // Collect user names from CSV for user fields
      const userNames = UserNameUtils.extractUserNames(rows, headers, UserNameUtils.USER_FIELDS);
      const userIdMap = await UserNameUtils.fetchUserIdsByNames(userNames);
      console.log('GenericCSVProcessor: Fetched user IDs for', Object.keys(userIdMap).length, 'users');

      const result: ProcessingResult = {
        successCount: 0,
        updateCount: 0,
        duplicateCount: 0,
        errorCount: 0,
        errors: []
      };

      // Process rows in batches
      const batchSize = 50;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const batchResult = await this.processBatch(batch, headers, columnMap, options, userIdMap);
        
        result.successCount += batchResult.successCount;
        result.updateCount += batchResult.updateCount;
        result.duplicateCount += batchResult.duplicateCount;
        result.errorCount += batchResult.errorCount;
        result.errors.push(...batchResult.errors);

        // Report progress
        if (options.onProgress) {
          options.onProgress(Math.min(i + batchSize, rows.length), rows.length);
        }
      }

      console.log('GenericCSVProcessor: Processing complete:', result);
      return result;

    } catch (error: any) {
      console.error('GenericCSVProcessor: Processing failed:', error);
      throw new Error(`CSV processing failed: ${error.message}`);
    }
  }

  private async processBatch(
    rows: string[][],
    headers: string[],
    columnMap: Record<string, string>,
    options: ProcessingOptions,
    userIdMap: Record<string, string>
  ): Promise<ProcessingResult> {
    
    const recordValidator = createRecordValidator(options.tableName);
    
    const result: ProcessingResult = {
      successCount: 0,
      updateCount: 0, 
      duplicateCount: 0,
      errorCount: 0,
      errors: []
    };

    for (const row of rows) {
      try {
        // Convert row to object
        const rowObj: Record<string, any> = {};
        headers.forEach((header, index) => {
          const dbColumn = columnMap[header];
          if (dbColumn && row[index] !== undefined) {
            let value = row[index];
            
            // Convert display name to UUID for user fields
            if (UserNameUtils.isUserField(dbColumn) && value) {
              value = UserNameUtils.resolveUserId(value, userIdMap, options.userId);
            }
            
            // Apply date formatting if needed
            const processedValue = DateFormatUtils.processFieldForImport(dbColumn, value);
            rowObj[dbColumn] = processedValue;
          }
        });

        // Validate record
        const isValid = recordValidator(rowObj);
        if (!isValid) {
          result.errorCount++;
          const rowPreview = rowObj.contact_name || rowObj.lead_name || rowObj.id || 'Unknown';
          result.errors.push(`Validation failed for: ${rowPreview}`);
          continue;
        }

        // Check if record exists by ID (if ID is provided)
        let existingRecord = null;
        if (rowObj.id) {
          const { data: existing } = await supabase
            .from(options.tableName as any)
            .select('id')
            .eq('id', rowObj.id)
            .single();
          
          existingRecord = existing;
        }

        if (existingRecord) {
          // Update existing record
          const updateData = { ...rowObj };
          updateData.modified_by = options.userId;
          updateData.modified_time = new Date().toISOString();
          
          // Remove id from update data to avoid conflicts
          delete updateData.id;
          
          const { error: updateError } = await supabase
            .from(options.tableName as any)
            .update(updateData)
            .eq('id', existingRecord.id);

          if (updateError) {
            result.errorCount++;
            result.errors.push(`Update failed: ${updateError.message}`);
          } else {
            result.updateCount++;
            console.log('Record updated successfully:', existingRecord.id);
          }
        } else {
          // Insert new record
          const insertData = { ...rowObj };
          insertData.created_by = options.userId;
          insertData.modified_by = options.userId;
          
          // If no ID provided, let database generate one
          if (!insertData.id) {
            delete insertData.id;
          }

          const { error: insertError } = await supabase
            .from(options.tableName as any)
            .insert([insertData]);

          if (insertError) {
            result.errorCount++;
            const rowPreview = insertData.contact_name || insertData.lead_name || insertData.id || 'Unknown';
            result.errors.push(`Insert failed for "${rowPreview}": ${insertError.message}`);
          } else {
            result.successCount++;
            console.log('New record inserted successfully');
          }
        }

      } catch (error: any) {
        result.errorCount++;
        result.errors.push(`Row processing error: ${error.message}`);
        console.error('Row processing error:', error);
      }
    }

    return result;
  }
}
