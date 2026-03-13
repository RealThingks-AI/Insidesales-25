import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const useSecurityAudit = () => {
  const { user } = useAuth();

  const logSecurityEvent = useCallback(async (
    action: string,
    resourceType: string,
    resourceId?: string,
    details?: any
  ) => {
    try {
      // Use cached user from useAuth - no network call needed
      if (!user) {
        console.log('No authenticated user, skipping security event logging');
        return;
      }

      // Fire and forget - don't await
      supabase.rpc('log_security_event', {
        p_action: action,
        p_resource_type: resourceType,
        p_resource_id: resourceId,
        p_details: details
      }).then(({ error }) => {
        if (error) {
          console.error('Failed to log security event:', error);
        }
      });
    } catch (error) {
      console.error('Security audit logging error:', error);
    }
  }, [user]);

  const logDataAccess = useCallback(async (
    tableName: string,
    operation: string,
    recordId?: string
  ) => {
    try {
      // Use cached user from useAuth - no network call needed
      if (!user) {
        console.log('No authenticated user, skipping data access logging');
        return;
      }

      // Only log mutations, not reads - reduces log volume significantly
      if (operation === 'SELECT') {
        return;
      }

      // Fire and forget - don't await
      supabase.rpc('log_data_access', {
        p_table_name: tableName,
        p_operation: operation,
        p_record_id: recordId
      }).then(({ error }) => {
        if (error) {
          console.error('Failed to log data access:', error);
        }
      });
    } catch (error) {
      console.error('Data access logging error:', error);
    }
  }, [user]);

  return {
    logSecurityEvent,
    logDataAccess
  };
};
