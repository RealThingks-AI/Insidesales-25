
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Deal, DealStage, getNextStage, getFinalStageOptions, getStageIndex, DEAL_STAGES } from "@/types/deal";
import { useToast } from "@/hooks/use-toast";
import { validateRequiredFields, getFieldErrors, validateDateLogic, validateRevenueSum } from "./deal-form/validation";
import { DealStageForm } from "./deal-form/DealStageForm";
import { DealActionItemsModal } from "./DealActionItemsModal";
import { supabase } from "@/integrations/supabase/client";
import { useUserDisplayNames } from "@/hooks/useUserDisplayNames";

interface DealFormProps {
  deal: Deal | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (dealData: Partial<Deal>) => Promise<void>;
  onRefresh?: () => Promise<void>;
  isCreating?: boolean;
  initialStage?: DealStage;
   onDelete?: (dealId: string) => void;
}

 export const DealForm = ({ deal, isOpen, onClose, onSave, isCreating = false, initialStage, onRefresh, onDelete }: DealFormProps) => {
   const [deleteLoading, setDeleteLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Deal>>({});
  const [loading, setLoading] = useState(false);
  const [showPreviousStages, setShowPreviousStages] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const { toast } = useToast();

  // NEW: Track current user id for default Lead Owner
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { displayNames: currentUserDisplayNames } = useUserDisplayNames(currentUserId ? [currentUserId] : []);

  // Fetch current user once when creating a deal
  useEffect(() => {
    if (!isCreating) return;
    supabase.auth.getUser().then(({ data, error }) => {
      if (error) {
        console.warn("DealForm: Failed to get current user for lead owner default:", error);
        return;
      }
      const uid = data?.user?.id || null;
      setCurrentUserId(uid);
      console.log("DealForm: currentUserId for default lead owner:", uid);
    });
  }, [isCreating]);

  // Auto-fill Lead Owner for new deal creation if missing/Unknown
  useEffect(() => {
    if (!isCreating) return;
    if (!currentUserId) return;

    const name = currentUserDisplayNames[currentUserId];
    if (!name) return;

    setFormData(prev => {
      const current = prev.lead_owner;
      if (current && current !== "Unknown User") {
        // Respect user-entered value or previously resolved name
        return prev;
      }
      console.log("DealForm: Auto-setting lead_owner to current user's display name:", name);
      return { ...prev, lead_owner: name };
    });
  }, [isCreating, currentUserId, currentUserDisplayNames]);

  useEffect(() => {
    if (deal) {
      console.log("Setting form data from deal:", deal);
      // Initialize revenue fields with 0 if they are null
      const initializedDeal = {
        ...deal,
        quarterly_revenue_q1: deal.quarterly_revenue_q1 ?? 0,
        quarterly_revenue_q2: deal.quarterly_revenue_q2 ?? 0,
        quarterly_revenue_q3: deal.quarterly_revenue_q3 ?? 0,
        quarterly_revenue_q4: deal.quarterly_revenue_q4 ?? 0,
      };
      setFormData(initializedDeal);
      setShowValidationErrors(false);
    } else if (isCreating && initialStage) {
      // Set default values for new deals
      const defaultData: Partial<Deal> = {
        stage: initialStage,
        currency_type: 'EUR', // Default to EUR
        quarterly_revenue_q1: 0,
        quarterly_revenue_q2: 0,
        quarterly_revenue_q3: 0,
        quarterly_revenue_q4: 0,
      };
      setFormData(defaultData);
      setShowValidationErrors(false);
    }
    setShowPreviousStages(false);
  }, [deal, isCreating, initialStage, isOpen]);

  const currentStage = formData.stage || 'Lead';

  // No field errors since validation is removed
  useEffect(() => {
    setFieldErrors({});
  }, [formData, currentStage, showValidationErrors]);

  const handleFieldChange = (field: string, value: any) => {
    console.log(`=== FIELD UPDATE DEBUG ===`);
    console.log(`Updating field: ${field}`);
    console.log(`New value:`, value, `(type: ${typeof value})`);
    console.log(`Current formData before update:`, formData);
    
    setFormData(prev => {
      const updated = { ...prev };
      // Use type assertion to bypass strict type checking for dynamic assignment
      (updated as any)[field] = value;
      return updated;
    });
  };

  const handleContactSelect = (contact: any) => {
    console.log("Selected contact:", contact);
    // The contact selection is handled in the FormFieldRenderer component
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log("=== DEAL FORM SUBMIT DEBUG ===");
      console.log("Current stage:", currentStage);
      console.log("Form data before save:", formData);
      
      // No validation - allow saving with any data
      const saveData = {
        ...formData,
        deal_name: formData.project_name || formData.deal_name || 'Untitled Deal',
        modified_at: new Date().toISOString(),
        modified_by: deal?.created_by || formData.created_by
      };
      
      console.log("Save data:", saveData);
      
      await onSave(saveData);
      
      console.log("Save successful");
      toast({
        title: "Success",
        description: isCreating ? "Deal created successfully" : "Deal updated successfully",
      });
      
      if (onRefresh) {
        await onRefresh();
      }
      
      onClose();
    } catch (error) {
      console.error("=== DEAL FORM SAVE ERROR ===");
      console.error("Error details:", error);
      
      toast({
        title: "Error",
        description: `Failed to save deal: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMoveToNextStage = async () => {
    setLoading(true);
    
    try {
      const nextStage = getNextStage(currentStage);
      if (nextStage) {
        console.log(`Moving deal from ${currentStage} to ${nextStage}`);
        
        const updatedData = {
          ...formData,
          stage: nextStage,
          deal_name: formData.project_name || formData.deal_name || 'Untitled Deal',
          modified_at: new Date().toISOString(),
          modified_by: deal?.created_by || formData.created_by
        };
        
        await onSave(updatedData);
        
        toast({
          title: "Success",
          description: `Deal moved to ${nextStage} stage`,
        });
        
        onClose();
        if (onRefresh) {
          setTimeout(() => onRefresh(), 200);
        }
      }
    } catch (error) {
      console.error("Error moving deal to next stage:", error);
      toast({
        title: "Error",
        description: "Failed to move deal to next stage",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMoveToFinalStage = async (finalStage: DealStage) => {
    setLoading(true);
    
    try {
      console.log(`Moving deal to final stage: ${finalStage}`);
      
      const updatedData = {
        ...formData,
        stage: finalStage,
        deal_name: formData.project_name || formData.deal_name || 'Untitled Deal',
        modified_at: new Date().toISOString(),
        modified_by: deal?.created_by || formData.created_by
      };
      
      setFormData(updatedData);
      await onSave(updatedData);
      
      toast({
        title: "Success",
        description: `Deal moved to ${finalStage} stage`,
      });
      
      onClose();
      if (onRefresh) {
        setTimeout(() => onRefresh(), 200);
      }
    } catch (error) {
      console.error("Error moving deal to final stage:", error);
      toast({
        title: "Error",
        description: `Failed to move deal to ${finalStage} stage`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMoveToSpecificStage = async (targetStage: DealStage) => {
    setLoading(true);
    
    try {
      console.log(`Moving deal from ${currentStage} to ${targetStage}`);
      
      const updatedData = {
        ...formData,
        stage: targetStage,
        deal_name: formData.project_name || formData.deal_name || 'Untitled Deal',
        modified_at: new Date().toISOString(),
        modified_by: deal?.created_by || formData.created_by
      };
      
      setFormData(updatedData);
      await onSave(updatedData);
      
      toast({
        title: "Success",
        description: `Deal moved to ${targetStage} stage`,
      });
      
      onClose();
      if (onRefresh) {
        setTimeout(() => onRefresh(), 200);
      }
    } catch (error) {
      console.error("Error moving deal to stage:", error);
      toast({
        title: "Error",
        description: `Failed to move deal to ${targetStage} stage`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Allow movement to any stage - no restrictions
  const getAvailableStagesForMoveTo = (): DealStage[] => {
    const allStages: DealStage[] = ['Lead', 'Discussions', 'Qualified', 'RFQ', 'Offered', 'Won', 'Lost', 'Dropped'];
    return allStages.filter(stage => stage !== currentStage);
  };

  // No validation - always allow movement and saving
  const canMoveToNextStage = !isCreating && getNextStage(currentStage) !== null;
  const canMoveToFinalStage = !isCreating;
  const canSave = true; // Always allow saving

  const handleActionButtonClick = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent form submission
    e.stopPropagation(); // Stop event bubbling
    setActionModalOpen(true);
  };

   const handleDelete = async () => {
     if (!deal?.id || !onDelete) return;
     
     setDeleteLoading(true);
     try {
       onDelete(deal.id);
       onClose();
     } catch (error) {
       console.error("Error deleting deal:", error);
       toast({
         title: "Error",
         description: "Failed to delete deal",
         variant: "destructive",
       });
     } finally {
       setDeleteLoading(false);
     }
   };
 
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold">
                {isCreating ? 'Create New Deal' : formData.project_name || 'Edit Deal'}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-sm px-3 py-1">
                  {currentStage}
                </Badge>
                {!isCreating && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      console.log("Toggle button clicked! Current state:", showPreviousStages);
                      setShowPreviousStages(!showPreviousStages);
                      console.log("New state will be:", !showPreviousStages);
                    }}
                  >
                    {showPreviousStages ? 'Hide Previous Stages' : 'Show All Stages'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <DealStageForm
            formData={formData}
            onFieldChange={handleFieldChange}
            onContactSelect={handleContactSelect}
            fieldErrors={fieldErrors}
            stage={currentStage}
            showPreviousStages={showPreviousStages}
          />

          {/* Action Buttons */}
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="btn-primary">
                {loading ? "Saving..." : "Save"}
              </Button>
               {/* Delete button - only for existing deals */}
               {!isCreating && deal && onDelete && (
                 <AlertDialog>
                   <AlertDialogTrigger asChild>
                     <Button 
                       type="button" 
                       variant="destructive" 
                       disabled={deleteLoading}
                     >
                       <Trash2 className="w-4 h-4 mr-2" />
                       {deleteLoading ? "Deleting..." : "Delete"}
                     </Button>
                   </AlertDialogTrigger>
                   <AlertDialogContent>
                     <AlertDialogHeader>
                       <AlertDialogTitle>Delete Deal</AlertDialogTitle>
                       <AlertDialogDescription>
                         Are you sure you want to delete "{deal.project_name || deal.deal_name}"? This action cannot be undone.
                       </AlertDialogDescription>
                     </AlertDialogHeader>
                     <AlertDialogFooter>
                       <AlertDialogCancel>Cancel</AlertDialogCancel>
                       <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                         Delete
                       </AlertDialogAction>
                     </AlertDialogFooter>
                   </AlertDialogContent>
                 </AlertDialog>
               )}
            </div>

            <div className="flex gap-2">
              {/* Move to Stage Dropdown - Allow movement to any stage */}
              {!isCreating && getAvailableStagesForMoveTo().length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Move to:</span>
                  <Select
                    value=""
                    onValueChange={(value) => {
                      handleMoveToSpecificStage(value as DealStage);
                    }}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select stage..." />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableStagesForMoveTo().map(stage => (
                        <SelectItem key={stage} value={stage}>
                          {stage}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {!isCreating && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleActionButtonClick}
                >
                  Action
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
      
      {/* Action Items Modal */}
      <DealActionItemsModal
        open={actionModalOpen}
        onOpenChange={setActionModalOpen}
        deal={deal}
      />
    </Dialog>
  );
};
