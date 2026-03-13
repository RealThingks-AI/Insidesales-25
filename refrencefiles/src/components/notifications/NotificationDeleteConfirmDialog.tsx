import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface NotificationDeleteConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  count?: number;
  isClearAll?: boolean;
}

export const NotificationDeleteConfirmDialog = ({
  open,
  onConfirm,
  onCancel,
  count = 1,
  isClearAll = false,
}: NotificationDeleteConfirmDialogProps) => {
  const title = isClearAll 
    ? "Clear All Read Notifications?" 
    : count > 1 
      ? `Delete ${count} Notifications?` 
      : "Delete Notification?";
  
  const description = isClearAll
    ? "This will permanently delete all read notifications. This action cannot be undone."
    : count > 1
      ? `This will permanently delete ${count} selected notifications. This action cannot be undone.`
      : "This will permanently delete this notification. This action cannot be undone.";

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
