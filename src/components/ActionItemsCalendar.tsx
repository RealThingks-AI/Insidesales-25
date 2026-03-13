import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameMonth,
  isToday,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { ActionItem, ActionItemPriority } from '@/hooks/useActionItems';

interface ActionItemsCalendarProps {
  actionItems: ActionItem[];
  onEdit: (actionItem: ActionItem) => void;
}

const priorityConfig: Record<ActionItemPriority, string> = {
  Low: 'bg-blue-500',
  Medium: 'bg-yellow-500',
  High: 'bg-red-500',
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ActionItemsCalendar({ actionItems, onEdit }: ActionItemsCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Group action items by due date
  const itemsByDate = useMemo(() => {
    const grouped: Record<string, ActionItem[]> = {};
    actionItems.forEach((item) => {
      if (item.due_date) {
        const dateKey = format(new Date(item.due_date), 'yyyy-MM-dd');
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(item);
      }
    });
    return grouped;
  }, [actionItems]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  const goToToday = () => setCurrentMonth(new Date());
  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const getItemsForDate = (date: Date): ActionItem[] => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return itemsByDate[dateKey] || [];
  };

  return (
    <div className="flex flex-col h-full">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 mb-2">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-2 text-center text-sm font-medium text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 flex-1 border-l border-t">
        {calendarDays.map((day, index) => {
          const items = getItemsForDate(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isTodayDate = isToday(day);
          const visibleItems = items.slice(0, 3);
          const remainingItems = items.slice(3);
          const hasMore = remainingItems.length > 0;

          return (
            <div
              key={index}
              className={cn(
                'border-r border-b p-1.5 min-h-[120px] overflow-hidden',
                !isCurrentMonth && 'bg-muted/30'
              )}
            >
              {/* Day Number - top left aligned */}
              <div className="flex justify-start mb-1">
                <span
                  className={cn(
                    'text-sm w-7 h-7 flex items-center justify-center rounded-full',
                    isTodayDate && 'bg-primary text-primary-foreground font-semibold',
                    !isCurrentMonth && 'text-muted-foreground'
                  )}
                >
                  {format(day, 'd')}
                </span>
              </div>

              {/* Action Items */}
              <div className="space-y-0.5 overflow-hidden">
                {visibleItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-1.5 px-1.5 py-1 rounded cursor-pointer hover:bg-muted/50 group"
                    onClick={() => onEdit(item)}
                  >
                    <span
                      className={cn(
                        'w-2 h-2 rounded-full flex-shrink-0',
                        priorityConfig[item.priority]
                      )}
                    />
                    <span className="text-xs truncate group-hover:underline">
                      {item.title}
                    </span>
                  </div>
                ))}
                {hasMore && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="text-xs text-muted-foreground px-1.5 py-0.5 hover:bg-muted/50 rounded cursor-pointer hover:underline w-full text-left">
                        +{remainingItems.length} more
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-2" align="start">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          {format(day, 'EEEE, MMM d')}
                        </p>
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer hover:bg-muted/50"
                            onClick={() => onEdit(item)}
                          >
                            <span
                              className={cn(
                                'w-2 h-2 rounded-full flex-shrink-0',
                                priorityConfig[item.priority]
                              )}
                            />
                            <span className="text-sm truncate hover:underline">
                              {item.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
