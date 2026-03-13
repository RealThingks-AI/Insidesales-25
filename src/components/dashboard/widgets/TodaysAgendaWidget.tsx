import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Circle } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface AgendaItem {
  id: string;
  title: string;
  priority: string;
  due_time: string | null;
  module_type: string;
}

interface Props {
  data: AgendaItem[];
}

const priorityColors: Record<string, string> = {
  High: 'bg-destructive/10 text-destructive border-destructive/20',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  Low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export const TodaysAgendaWidget = ({ data }: Props) => {
  const today = format(new Date(), 'EEEE, MMM d');

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">Today's Agenda</CardTitle>
        </div>
        <span className="text-xs text-muted-foreground">{today}</span>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <CalendarDays className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm font-medium">Clear day ahead!</p>
            <p className="text-xs">No tasks due today</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {data.map(item => (
              <div key={item.id} className="flex items-start gap-2 p-2 rounded-md bg-muted/30 border border-border/50">
                <Circle className="h-2 w-2 mt-1.5 shrink-0 text-primary fill-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{item.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {item.due_time && (
                      <span className="text-[10px] text-muted-foreground">{item.due_time}</span>
                    )}
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${priorityColors[item.priority] || ''}`}>
                      {item.priority}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
