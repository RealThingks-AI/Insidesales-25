import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Zap, Users, Building2, Briefcase, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

const actions = [
  { label: 'Contact', icon: Users, path: '/contacts', color: 'text-blue-600' },
  { label: 'Account', icon: Building2, path: '/accounts', color: 'text-emerald-600' },
  { label: 'Deal', icon: Briefcase, path: '/deals', color: 'text-violet-600' },
  { label: 'Task', icon: CheckSquare, path: '/action-items', color: 'text-amber-600' },
];

export const QuickActionsWidget = () => {
  const navigate = useNavigate();

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {actions.map(a => (
            <Button
              key={a.label}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 justify-start h-9 text-xs"
              onClick={() => navigate(a.path)}
            >
              <a.icon className={`h-3.5 w-3.5 ${a.color}`} />
              + {a.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
