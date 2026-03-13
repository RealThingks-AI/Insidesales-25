import { cn } from "@/lib/utils";
import { DealExpandedPanel } from "@/components/DealExpandedPanel";
import { Deal } from "@/types/deal";

type TransitionState = 'idle' | 'expanding' | 'expanded' | 'collapsing';

interface InlineDetailsPanelProps {
  deal: Deal;
  transition: TransitionState;
  onClose: () => void;
  onOpenActionItemModal?: (actionItem?: any) => void;
  addDetailOpen?: boolean;
  onAddDetailOpenChange?: (open: boolean) => void;
}

export function InlineDetailsPanel({
  deal,
  transition,
  onClose,
  onOpenActionItemModal,
  addDetailOpen,
  onAddDetailOpenChange,
}: InlineDetailsPanelProps) {
  return (
    <div 
      className={cn(
        "flex flex-col overflow-y-auto",
        transition === 'expanding' && 'inline-details-entering',
        transition === 'collapsing' && 'inline-details-exiting',
      )}
      style={{ 
        minHeight: '550px',
        maxHeight: 'calc(100vh - 140px)',
      }}
    >
      <DealExpandedPanel 
        deal={deal} 
        onClose={onClose}
        onOpenActionItemModal={onOpenActionItemModal}
        addDetailOpen={addDetailOpen}
        onAddDetailOpenChange={onAddDetailOpenChange}
      />
    </div>
  );
}
