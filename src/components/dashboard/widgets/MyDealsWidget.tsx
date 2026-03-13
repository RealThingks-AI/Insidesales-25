import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Briefcase } from "lucide-react";

interface Props {
  data: { stage: string; count: number }[];
}

const stageColors: Record<string, string> = {
  Lead: 'text-blue-600',
  Discussions: 'text-violet-600',
  Qualified: 'text-cyan-600',
  RFQ: 'text-amber-600',
  Offered: 'text-orange-500',
  Won: 'text-emerald-600',
  Lost: 'text-red-500',
  Dropped: 'text-muted-foreground',
};

export const MyDealsWidget = ({ data }: Props) => {
  const navigate = useNavigate();
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">My Deals</CardTitle>
        </div>
        <button onClick={() => navigate('/deals')} className="text-xs text-primary hover:underline font-medium">
          View All →
        </button>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold mb-3">{total}</div>
        <div className="grid grid-cols-2 gap-2">
          {data.map(d => (
            <div key={d.stage} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground truncate">{d.stage}</span>
              <span className={`font-bold ${stageColors[d.stage] || 'text-foreground'}`}>{d.count}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
