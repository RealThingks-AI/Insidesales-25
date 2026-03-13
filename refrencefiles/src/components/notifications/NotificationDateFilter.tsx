import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface NotificationDateFilterProps {
  value: string;
  onValueChange: (value: string) => void;
}

const dateRanges = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "7days", label: "Last 7 Days" },
  { value: "30days", label: "Last 30 Days" },
];

export const NotificationDateFilter = ({ value, onValueChange }: NotificationDateFilterProps) => {
  const isFiltered = value && value !== "all";
  
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={cn("w-36 relative", isFiltered && "border-primary")}>
        <SelectValue placeholder="Date range" />
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
        {dateRanges.map((range) => (
          <SelectItem key={range.value} value={range.value}>
            {range.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
