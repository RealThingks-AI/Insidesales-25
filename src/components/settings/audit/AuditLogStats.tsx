import { Badge } from "@/components/ui/badge";

interface AuditLogStatsProps {
  total: number;
  todayCount: number;
  weekCount: number;
  byModule: Record<string, number>;
  byUser: Record<string, number>;
  userNames: Record<string, string>;
}

export const AuditLogStats = ({ total, todayCount, weekCount, byModule }: AuditLogStatsProps) => {
  const topModules = Object.entries(byModule)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="flex flex-wrap items-center gap-2 px-1">
      <Badge variant="secondary" className="gap-1.5 text-xs font-medium py-1">
        Total <span className="font-bold">{total}</span>
      </Badge>
      <Badge className="gap-1.5 text-xs font-medium py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
        Today <span className="font-bold">{todayCount}</span>
      </Badge>
      <Badge className="gap-1.5 text-xs font-medium py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-0">
        This Week <span className="font-bold">{weekCount}</span>
      </Badge>
      <span className="text-muted-foreground text-xs">|</span>
      {topModules.map(([mod, count]) => (
        <Badge key={mod} variant="outline" className="gap-1.5 text-xs font-normal py-1">
          {mod} <span className="font-bold">{count}</span>
        </Badge>
      ))}
    </div>
  );
};
