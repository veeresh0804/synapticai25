import React, { useEffect, useState } from 'react';
import { Bell, CheckCheck, Trophy, Calendar, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

const NotificationBell: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user, userType } = useAuth();

  useEffect(() => {
    if (!user) return;
    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) setNotifications(data as Notification[]);
    };

    fetchNotifications();

    // Realtime subscription (mock client returns no-op channel)
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user?.id}` },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    const prev = notifications;
    setNotifications((p) => p.map((n) => ({ ...n, is_read: true })));
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', unreadIds);
    if (error) setNotifications(prev);
  };

  const handleClick = async (notification: Notification) => {
    if (!notification.is_read) {
      const prev = notifications;
      setNotifications((p) =>
        p.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      );
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notification.id);
      if (error) setNotifications(prev);
    }
    if (notification.link) {
      setOpen(false);
      const link = notification.link.startsWith('http')
        ? notification.link
        : notification.link.startsWith('/student/')
          ? notification.link
          : notification.link === '/notifications'
            ? '/student/notifications'
            : notification.link;
      if (link.startsWith('http')) {
        window.open(link, '_blank', 'noopener');
      } else {
        navigate(link);
      }
    }
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'shortlisted':
        return <Trophy className="w-4 h-4 text-green-500 shrink-0" />;
      case 'interview':
        return <Calendar className="w-4 h-4 text-primary shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-muted-foreground shrink-0" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'} className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h4 className="font-semibold text-sm">Notifications</h4>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="text-xs gap-1 h-7" onClick={markAllRead}>
                <CheckCheck className="w-3 h-3" /> Mark all read
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left px-4 py-3 flex gap-3 items-start hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0 ${
                  !n.is_read ? 'bg-primary/5' : ''
                }`}
              >
                {typeIcon(n.type)}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-tight ${!n.is_read ? 'font-semibold' : 'font-medium'}`}>
                    {n.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    {(() => { const d = new Date(n.created_at); return isNaN(d.getTime()) ? '' : formatDistanceToNow(d, { addSuffix: true }); })()}
                  </p>
                </div>
                {!n.is_read && (
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                )}
              </button>
            ))
          )}
        </ScrollArea>
        {userType === 'student' && (
        <div className="border-t border-border px-4 py-2">
          <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => { setOpen(false); navigate('/student/notifications'); }}>
            View all notifications
          </Button>
        </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
