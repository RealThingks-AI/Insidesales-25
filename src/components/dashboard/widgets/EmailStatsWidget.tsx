import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail } from "lucide-react";

interface Props {
  data: { sent: number; opened: number; rate: number };
}

export const EmailStatsWidget = ({ data }: Props) => {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">Email Statistics</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{data.sent}</div>
            <div className="text-xs text-muted-foreground mt-1">Sent</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600">{data.opened}</div>
            <div className="text-xs text-muted-foreground mt-1">Opened</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-600">{data.rate}%</div>
            <div className="text-xs text-muted-foreground mt-1">Open Rate</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
