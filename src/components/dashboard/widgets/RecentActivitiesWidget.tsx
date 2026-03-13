import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

interface ActivityItem {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  created_at: string;
  details: any;
}

interface Props {
  data: ActivityItem[];
}

const actionColors: Record<string, string> = {
  CREATE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  UPDATE: 'bg-blue-100 text-blue-700 border-blue-200',
  DELETE: 'bg-red-100 text-red-700 border-red-200',
  READ: 'bg-muted text-muted-foreground border-border',
};

function getActionBadgeClass(action: string) {
  const upper = action.toUpperCase();
  for (const key of Object.keys(actionColors)) {
    if (upper.includes(key)) return actionColors[key];
  }
  return 'bg-muted text-muted-foreground border-border';
}

function formatAction(action: string) {
  const upper = action.toUpperCase();
  if (upper.includes('CREATE') || upper.includes('INSERT')) return 'Created';
  if (upper.includes('UPDATE') || upper.includes('EDIT')) return 'Updated';
  if (upper.includes('DELETE') || upper.includes('REMOVE')) return 'Deleted';
  return action.length > 12 ? action.slice(0, 12) + '…' : action;
}

export const RecentActivitiesWidget = ({ data }: Props) => {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">Recent Activities</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No recent activities</p>
        ) : (
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {data.map(item => (
              <div key={item.id} className="flex items-center gap-2 text-xs p-2 rounded-md bg-muted/30 border border-border/50">
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${getActionBadgeClass(item.action)}`}>
                  {formatAction(item.action)}
                </Badge>
                <span className="font-medium truncate capitalize">{item.resource_type.replace(/_/g, ' ')}</span>
                <span className="text-muted-foreground ml-auto shrink-0">
                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
