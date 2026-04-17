
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface Notification {
  id: string;
  user_id: string;
  lead_id: string | null;
  message: string;
  status: 'read' | 'unread';
  notification_type: string;
  action_item_id: string | null;
  module_type: string | null;
  module_id: string | null;
  created_at: string;
  updated_at: string;
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalNotifications, setTotalNotifications] = useState(0);
  const { toast } = useToast();
  const { user } = useAuth();

  const itemsPerPage = 50;

  // Fetch notifications with pagination
  const fetchNotifications = async (page: number = 1) => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Get total count for pagination
      const { count, error: countError } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (countError) throw countError;
      setTotalNotifications(count || 0);

      // Get paginated notifications
      const startIndex = (page - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage - 1;
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(startIndex, endIndex);

      if (error) throw error;

      const typedNotifications: Notification[] = (data || []).map(item => ({
        ...item,
        status: item.status as 'read' | 'unread'
      }));

      setNotifications(typedNotifications);
      setCurrentPage(page);
      
      // Get total unread count separately
      const { data: unreadData, error: unreadError } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'unread');
      
      if (!unreadError) {
        setUnreadCount(unreadData?.length || 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast({
        title: "Error",
        description: "Failed to fetch notifications",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ status: 'read' })
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, status: 'read' as const } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ status: 'read' })
        .eq('user_id', user.id)
        .eq('status', 'unread');

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => ({ ...n, status: 'read' as const }))
      );
      setUnreadCount(0);

      toast({
        title: "Success",
        description: "All notifications marked as read"
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast({
        title: "Error",
        description: "Failed to mark notifications as read",
        variant: "destructive"
      });
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;

      const deletedNotification = notifications.find(n => n.id === notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      if (deletedNotification?.status === 'unread') {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }

      toast({
        title: "Success",
        description: "Notification deleted"
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast({
        title: "Error",
        description: "Failed to delete notification",
        variant: "destructive"
      });
    }
  };

  // Set up real-time subscription for notifications
  useEffect(() => {
    if (!user) return;

    fetchNotifications();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('New notification received:', payload);
          const newNotification = { 
            ...payload.new, 
            status: payload.new.status as 'read' | 'unread' 
          } as Notification;
          
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);

          // Show toast notification for new action item notifications
          if (newNotification.notification_type === 'action_item') {
            toast({
              title: "New Action Item Notification",
              description: newNotification.message,
              duration: 5000,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Notification updated:', payload);
          const updatedNotification = { 
            ...payload.new, 
            status: payload.new.status as 'read' | 'unread' 
          } as Notification;
          
          setNotifications(prev => 
            prev.map(n => 
              n.id === updatedNotification.id ? updatedNotification : n
            )
          );
          
          // Recalculate unread count
          const newUnreadCount = notifications.filter(n => 
            n.id === updatedNotification.id 
              ? updatedNotification.status === 'unread'
              : n.status === 'unread'
          ).length;
          setUnreadCount(newUnreadCount);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Notification deleted:', payload);
          const deletedNotification = { 
            ...payload.old, 
            status: payload.old.status as 'read' | 'unread' 
          } as Notification;
          
          setNotifications(prev => prev.filter(n => n.id !== deletedNotification.id));
          
          if (deletedNotification.status === 'unread') {
            setUnreadCount(prev => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast]);

  return {
    notifications,
    unreadCount,
    loading,
    currentPage,
    totalNotifications,
    itemsPerPage,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    fetchNotifications,
    setCurrentPage
  };
};
