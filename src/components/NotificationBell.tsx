import { useState, useRef, useEffect } from 'react';
import { Bell, X, MoreVertical, Trash2, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface NotificationBellProps { 
  placement?: 'up' | 'down'
  size?: 'small' | 'large'
}

export const NotificationBell = ({ placement = 'down', size = 'large' }: NotificationBellProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notification: any) => {
    // Mark as read first
    if (notification.status === 'unread') {
      await markAsRead(notification.id);
    }

    // If we have an action_item_id, navigate to action items page with highlight
    if (notification.action_item_id) {
      navigate(`/action-items?highlight=${notification.action_item_id}`);
      setIsOpen(false);
      return;
    }

    // Fallback navigation based on module_type
    if (notification.module_type === 'deals' && notification.module_id) {
      navigate(`/deals?highlight=${notification.module_id}`);
    } else if (notification.module_type === 'leads' && notification.module_id) {
      navigate(`/deals`);
    } else if (notification.module_type === 'contacts' && notification.module_id) {
      navigate(`/contacts?highlight=${notification.module_id}`);
    } else if (notification.lead_id) {
      navigate(`/deals`);
    } else if (notification.notification_type === 'action_item') {
      navigate('/action-items');
    } else if (notification.notification_type === 'deal_update') {
      navigate('/deals');
    } else if (notification.notification_type === 'lead_update') {
      navigate('/deals');
    } else {
      navigate('/action-items');
    }
    
    setIsOpen(false);
  };

  const handleMarkAllRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await markAllAsRead();
  };

  const handleDeleteNotification = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    await deleteNotification(notificationId);
  };

  const getNotificationIcon = (notification: any) => {
    const message = notification.message || '';
    const type = notification.notification_type;
    
    // Check for emoji prefixes first (from trigger)
    if (message.includes('🔴')) return '🔴';
    if (message.includes('✅')) return '✅';
    if (message.includes('🗑️')) return '🗑️';
    if (message.includes('📊')) return '📊';
    if (message.includes('🔄')) return '🔄';
    
    // Check by notification type first
    if (type === 'deal_update') {
      if (message.toLowerCase().includes('deleted')) return '🗑️';
      if (message.toLowerCase().includes('stage')) return '📊';
      return '💼';
    }
    if (type === 'lead_update') {
      if (message.toLowerCase().includes('deleted')) return '🗑️';
      if (message.toLowerCase().includes('status')) return '🔄';
      return '👤';
    }
    
    // Action item notifications
    if (message.toLowerCase().includes('completed')) return '✅';
    if (message.toLowerCase().includes('deleted')) return '🗑️';
    if (message.toLowerCase().includes('assigned to you')) return '📋';
    if (message.toLowerCase().includes('reassigned')) return '🔄';
    if (message.toLowerCase().includes('priority') || message.toLowerCase().includes('high')) return '🔴';
    if (message.toLowerCase().includes('due date')) return '📅';
    
    // Fallback
    return '🔔';
  };

  return (
    <div className="relative" ref={dropdownRef} style={{ zIndex: 9999 }}>
      {/* Bell Icon Button */}
      <Button
        variant="outline"
        size={size === 'small' ? 'sm' : 'lg'}
        className={`relative p-0 bg-white hover:bg-blue-50 rounded-full border-2 border-gray-300 hover:border-blue-400 shadow-md hover:shadow-lg transition-all duration-200 ${
          size === 'small' ? 'h-8 w-8' : 'h-12 w-12'
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className={`text-gray-700 hover:text-blue-600 transition-colors ${
          size === 'small' ? 'h-4 w-4' : 'h-6 w-6'
        }`} />
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className={`absolute rounded-full p-0 flex items-center justify-center text-xs font-bold bg-red-500 text-white border-2 border-white shadow-lg animate-pulse ${
              size === 'small' 
                ? '-top-1 -right-1 h-5 w-5 text-[10px]' 
                : '-top-2 -right-2 h-6 w-6 text-xs'
            }`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Notifications Dropdown */}
      {isOpen && (
        <div 
          className={`absolute right-0 ${placement === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'} w-96 bg-white rounded-lg shadow-xl border border-gray-200`}
          style={{ 
            zIndex: 10000
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllRead}
                  className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                >
                  <CheckCheck className="h-4 w-4 mr-1" />
                  Mark all read
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-6 w-6 p-0 hover:bg-gray-200"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Notifications List */}
          <ScrollArea className="max-h-96">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-sm">No notifications yet</p>
                <p className="text-xs text-gray-400 mt-1">You'll see updates about action items here</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      "p-4 hover:bg-gray-50 cursor-pointer transition-colors relative group",
                      notification.status === 'unread' && "bg-blue-50 border-l-4 border-l-blue-500"
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-3">
                          <span className="text-lg mt-0.5">
                            {getNotificationIcon(notification)}
                          </span>
                          <div className="flex-1">
                            <p className={cn(
                              "text-sm text-gray-900 leading-relaxed",
                              notification.status === 'unread' && "font-semibold"
                            )}>
                              {notification.message}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <p className="text-xs text-gray-500">
                                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                              </p>
                              {notification.status === 'unread' && (
                                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                                  New
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Action Dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {notification.status === 'unread' && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                              }}
                            >
                              Mark as read
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => handleDeleteNotification(e, notification.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200 text-center bg-gray-50 rounded-b-lg">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                onClick={() => {
                  setIsOpen(false);
                  navigate('/notifications');
                }}
              >
                View all notifications
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
