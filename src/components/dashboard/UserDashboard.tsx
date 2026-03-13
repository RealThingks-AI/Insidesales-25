import { useDashboardData } from "@/hooks/useDashboardData";
import { MyDealsWidget } from "./widgets/MyDealsWidget";
import { MyAccountsWidget } from "./widgets/MyAccountsWidget";
import { MyContactsWidget } from "./widgets/MyContactsWidget";
import { ActionItemsWidget } from "./widgets/ActionItemsWidget";
import { EmailStatsWidget } from "./widgets/EmailStatsWidget";
import { QuickActionsWidget } from "./widgets/QuickActionsWidget";
import { TodaysAgendaWidget } from "./widgets/TodaysAgendaWidget";
import { RecentActivitiesWidget } from "./widgets/RecentActivitiesWidget";
import { Skeleton } from "@/components/ui/skeleton";

export const UserDashboard = () => {
  const { data, isLoading } = useDashboardData();

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[180px] rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top row: 4 widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MyDealsWidget data={data.deals} />
        <MyAccountsWidget data={data.accounts} />
        <MyContactsWidget data={data.contacts} />
        <ActionItemsWidget data={data.actionItems} />
      </div>

      {/* Middle row: 2 widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <EmailStatsWidget data={data.emailStats} />
        <QuickActionsWidget />
      </div>

      {/* Bottom row: 2 widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TodaysAgendaWidget data={data.todaysAgenda} />
        <RecentActivitiesWidget data={data.recentActivities} />
      </div>
    </div>
  );
};
