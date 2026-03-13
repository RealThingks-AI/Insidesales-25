import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Key, Loader2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSecurityAudit } from "@/hooks/useSecurityAudit";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PasswordRequirement {
  label: string;
  met: boolean;
}

const SecuritySettings = () => {
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const { user } = useAuth();
  const { logSecurityEvent } = useSecurityAudit();

  // Password validation requirements
  const passwordRequirements = useMemo((): PasswordRequirement[] => {
    const password = passwordData.newPassword;
    return [
      { label: 'At least 8 characters', met: password.length >= 8 },
      { label: 'At least one uppercase letter', met: /[A-Z]/.test(password) },
      { label: 'At least one lowercase letter', met: /[a-z]/.test(password) },
      { label: 'At least one number', met: /\d/.test(password) },
      { label: 'At least one special character (!@#$%^&*)', met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
    ];
  }, [passwordData.newPassword]);

  const allRequirementsMet = passwordRequirements.every(req => req.met);
  const passwordsMatch = passwordData.newPassword === passwordData.confirmPassword && passwordData.confirmPassword.length > 0;

  // Calculate password strength percentage
  const passwordStrength = useMemo(() => {
    const metCount = passwordRequirements.filter(req => req.met).length;
    return (metCount / passwordRequirements.length) * 100;
  }, [passwordRequirements]);

  const getStrengthColor = () => {
    if (passwordStrength < 40) return 'bg-destructive';
    if (passwordStrength < 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStrengthLabel = () => {
    if (passwordStrength < 40) return 'Weak';
    if (passwordStrength < 80) return 'Medium';
    return 'Strong';
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!allRequirementsMet) {
      toast.error('Please meet all password requirements');
      return;
    }

    if (!passwordsMatch) {
      toast.error('Passwords do not match');
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      await logSecurityEvent('PASSWORD_CHANGE', 'auth', user?.id, {
        changed_at: new Date().toISOString()
      });

      setPasswordData({ newPassword: '', confirmPassword: '' });
      setShowPasswordModal(false);
      
      toast.success('Your password has been changed successfully.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleCloseModal = () => {
    setShowPasswordModal(false);
    setPasswordData({ newPassword: '', confirmPassword: '' });
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="h-4 w-4" />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Password</p>
              <p className="text-xs text-muted-foreground">
                Update your password to keep your account secure
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowPasswordModal(true)}
            >
              <Key className="h-3.5 w-3.5 mr-1.5" />
              Change Password
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Password Change Modal */}
      <Dialog open={showPasswordModal} onOpenChange={handleCloseModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Change Password
            </DialogTitle>
            <DialogDescription>
              Create a strong password that meets all requirements
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="newPassword" className="text-xs">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordData.newPassword}
                onChange={e => setPasswordData(prev => ({
                  ...prev,
                  newPassword: e.target.value
                }))}
                placeholder="Enter new password"
                className="h-9"
                required
              />
              
              {/* Password Strength Indicator */}
              {passwordData.newPassword.length > 0 && (
                <div className="space-y-2 mt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Password strength</span>
                    <span className={`font-medium ${
                      passwordStrength < 40 ? 'text-destructive' : 
                      passwordStrength < 80 ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      {getStrengthLabel()}
                    </span>
                  </div>
                  <Progress value={passwordStrength} className="h-1.5" />
                </div>
              )}
            </div>
            
            {/* Password Requirements Checklist */}
            {passwordData.newPassword.length > 0 && (
              <div className="space-y-1.5 p-3 bg-muted/50 rounded-lg">
                <p className="text-xs font-medium text-muted-foreground mb-2">Requirements:</p>
                {passwordRequirements.map((req, index) => (
                  <div key={index} className="flex items-center gap-2 text-xs">
                    {req.met ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className={req.met ? 'text-foreground' : 'text-muted-foreground'}>
                      {req.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
            
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-xs">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordData.confirmPassword}
                onChange={e => setPasswordData(prev => ({
                  ...prev,
                  confirmPassword: e.target.value
                }))}
                placeholder="Confirm new password"
                className="h-9"
                required
              />
              {passwordData.confirmPassword.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs mt-1">
                  {passwordsMatch ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-green-500" />
                      <span className="text-green-600">Passwords match</span>
                    </>
                  ) : (
                    <>
                      <X className="h-3.5 w-3.5 text-destructive" />
                      <span className="text-destructive">Passwords do not match</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={handleCloseModal}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                size="sm"
                disabled={isChangingPassword || !allRequirementsMet || !passwordsMatch}
              >
                {isChangingPassword ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SecuritySettings;
