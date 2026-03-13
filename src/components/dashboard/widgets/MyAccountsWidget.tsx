import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  data: { status: string; count: number }[];
}

const statusColors: Record<string, string> = {
  New: 'text-blue-600',
  Working: 'text-amber-600',
  Hot: 'text-red-500',
  Nurture: 'text-emerald-600',
};

export const MyAccountsWidget = ({ data }: Props) => {
  const navigate = useNavigate();
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">My Accounts</CardTitle>
        </div>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => navigate('/accounts')}>
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold mb-3">{total}</div>
        <div className="grid grid-cols-2 gap-2">
          {data.map(d => (
            <div key={d.status} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{d.status}</span>
              <span className={`font-bold ${statusColors[d.status] || 'text-foreground'}`}>{d.count}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
