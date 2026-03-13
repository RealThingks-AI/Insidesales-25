import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Users, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  data: { source: string; count: number }[];
}

const sourceColors: Record<string, string> = {
  Website: 'text-blue-600',
  Referral: 'text-emerald-600',
  LinkedIn: 'text-cyan-600',
  Other: 'text-muted-foreground',
};

export const MyContactsWidget = ({ data }: Props) => {
  const navigate = useNavigate();
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">My Contacts</CardTitle>
        </div>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => navigate('/contacts')}>
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold mb-3">{total}</div>
        <div className="grid grid-cols-2 gap-2">
          {data.map(d => (
            <div key={d.source} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{d.source}</span>
              <span className={`font-bold ${sourceColors[d.source] || 'text-foreground'}`}>{d.count}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
