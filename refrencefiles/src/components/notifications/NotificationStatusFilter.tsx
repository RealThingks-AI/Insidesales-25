import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface NotificationStatusFilterProps {
  value: string;
  onValueChange: (value: string) => void;
}

const statuses = [
  { value: "all", label: "All Status" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
];

export const NotificationStatusFilter = ({ value, onValueChange }: NotificationStatusFilterProps) => {
  const isFiltered = value && value !== "all";
  
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={cn("w-32 relative", isFiltered && "border-primary")}>
        <SelectValue placeholder="Status" />
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
        {statuses.map((status) => (
          <SelectItem key={status.value} value={status.value}>
            {status.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
