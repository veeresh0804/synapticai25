import React, { useEffect, useState } from 'react';
import { Bell, Trophy, Calendar, Info, CheckCheck, Filter, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import { logger } from '@/lib/logger';
import PageShell from '@/components/shared/PageShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    const fetch = async () => {
      setLoading(true);
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('type', filter);
      }

      const { data } = await query;
      if (data) setNotifications(data as Notification[]);
      setLoading(false);
    };
    fetch();
  }, [filter, user?.id]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    const { error } = await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
    if (error) { logger.error('Failed to mark notifications read', error); return; }
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleClick = async (notification: Notification) => {
    if (!notification.is_read) {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notification.id);
      if (error) logger.error('Failed to mark notification read', error);
      else setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      );
    }
    if (notification.link) navigate(notification.link);
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'shortlisted':
        return <Trophy className="w-5 h-5 text-green-500 shrink-0" />;
      case 'interview':
        return <Calendar className="w-5 h-5 text-primary shrink-0" />;
      default:
        return <Info className="w-5 h-5 text-muted-foreground shrink-0" />;
    }
  };

  const typeBadge = (type: string) => {
    switch (type) {
      case 'shortlisted':
        return <Badge className="bg-green-500/15 text-green-600 border-green-500/30 hover:bg-green-500/20">Shortlisted</Badge>;
      case 'interview':
        return <Badge className="bg-primary/15 text-primary border-primary/30 hover:bg-primary/20">Interview</Badge>;
      default:
        return <Badge variant="secondary">General</Badge>;
    }
  };

  return (
    <PageShell>
      <div className="max-w-3xl mx-auto">
        <PageHeader
          eyebrow="Updates"
          title="Notifications"
          description={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
          backTo="/student/dashboard"
          backLabel="Back to dashboard"
          actions={
            unreadCount > 0 ? (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={markAllRead}>
                <CheckCheck className="w-4 h-4" /> Mark all read
              </Button>
            ) : undefined
          }
        />

        <Tabs value={filter} onValueChange={setFilter} className="mb-6">
          <TabsList className="flex-wrap h-auto max-w-full overflow-x-auto">
            <TabsTrigger value="all" className="gap-1.5">
              <Filter className="w-3.5 h-3.5" /> All
            </TabsTrigger>
            <TabsTrigger value="shortlisted" className="gap-1.5">
              <Trophy className="w-3.5 h-3.5" /> Shortlisted
            </TabsTrigger>
            <TabsTrigger value="interview" className="gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Interviews
            </TabsTrigger>
            <TabsTrigger value="info" className="gap-1.5">
              <Info className="w-3.5 h-3.5" /> General
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="surface-card">
              <EmptyState
                icon={<Bell className="w-6 h-6" />}
                title="No notifications found"
                description="You'll see them here when something happens."
              />
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`surface-card cursor-pointer transition-all hover:-translate-y-0.5 hover:border-primary/40 ${!n.is_read ? 'border-primary/30 bg-primary/[0.03]' : ''}`}
                onClick={() => handleClick(n)}
              >
                <div className="flex gap-4 items-start py-4 px-5">
                  <div className="mt-0.5">{typeIcon(n.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className={`text-sm leading-tight ${!n.is_read ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>
                        {n.title}
                      </p>
                      {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{n.message}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {typeBadge(n.type)}
                      <span className="text-xs text-muted-foreground/70">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        {' Â· '}
                        {format(new Date(n.created_at), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </PageShell>
  );
};

export default NotificationsPage;
