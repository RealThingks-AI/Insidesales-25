import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface NotificationTypeFilterProps {
  value: string;
  onValueChange: (value: string) => void;
}

const types = [
  { value: "all", label: "All Types" },
  { value: "task_assigned", label: "Task Assigned" },
  { value: "task_unassigned", label: "Task Unassigned" },
  { value: "task_completed", label: "Task Completed" },
  { value: "task_updated", label: "Task Updated" },
  { value: "task_deleted", label: "Task Deleted" },
  { value: "lead_update", label: "Lead Update" },
  { value: "deal_update", label: "Deal Update" },
];

export const NotificationTypeFilter = ({ value, onValueChange }: NotificationTypeFilterProps) => {
  const isFiltered = value && value !== "all";
  
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={cn("w-40 relative", isFiltered && "border-primary")}>
        <SelectValue placeholder="Type" />
        {isFiltered && (
          <Badge 
            variant="default" 
            className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs rounded-full"
          >
            1
          </Badge>
        )}
      </SelectTrigger>
      <SelectContent>
        {types.map((type) => (
          <SelectItem key={type.value} value={type.value}>
            {type.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
