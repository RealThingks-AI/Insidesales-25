import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export interface AccountColumnConfig {
  field: string;
  label: string;
  visible: boolean;
  order: number;
}

interface AccountColumnCustomizerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: AccountColumnConfig[];
  onColumnsChange: (columns: AccountColumnConfig[]) => void;
}

export const AccountColumnCustomizer = ({
  open,
  onOpenChange,
  columns,
  onColumnsChange,
}: AccountColumnCustomizerProps) => {
  const handleToggleColumn = (field: string) => {
    const updated = columns.map(col =>
      col.field === field ? { ...col, visible: !col.visible } : col
    );
    onColumnsChange(updated);
  };

  const handleShowAll = () => {
    const updated = columns.map(col => ({ ...col, visible: true }));
    onColumnsChange(updated);
  };

  const handleHideAll = () => {
    // Keep account_name and status always visible
    const updated = columns.map(col => ({
      ...col,
      visible: col.field === 'account_name' || col.field === 'status'
    }));
    onColumnsChange(updated);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Customize Columns</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleShowAll}>
              Show All
            </Button>
            <Button variant="outline" size="sm" onClick={handleHideAll}>
              Hide All
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {columns.map((column) => (
              <div key={column.field} className="flex items-center space-x-2">
                <Checkbox
                  id={column.field}
                  checked={column.visible}
                  onCheckedChange={() => handleToggleColumn(column.field)}
                  disabled={column.field === 'account_name' || column.field === 'status'} // Always show name and status
                />
                <Label
                  htmlFor={column.field}
                  className="text-sm font-normal cursor-pointer"
                >
                  {column.label}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
