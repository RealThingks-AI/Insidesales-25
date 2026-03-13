import React from 'react';
import { SecurityProvider } from '@/components/SecurityProvider';
import { AuthProvider } from '@/hooks/useAuth';
import { PermissionsProvider } from '@/contexts/PermissionsContext';

interface SecurityEnhancedAppProps {
  children: React.ReactNode;
}

const SecurityEnhancedApp = ({ children }: SecurityEnhancedAppProps) => {
  return (
    <AuthProvider>
      <PermissionsProvider>
        <SecurityProvider>
          {children}
        </SecurityProvider>
      </PermissionsProvider>
    </AuthProvider>
  );
};

export default SecurityEnhancedApp;
