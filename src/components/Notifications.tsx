import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Heart, UserPlus, FileText, Check, MessageSquare } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { generateAvatarStyle, getAvatarText } from '../lib/utils';

export function Notifications({ session }: { session: any }) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          actor:profiles!actor_id ( username, avatar_url )
        `)
        .eq('recipient_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        // Если таблицы нет, выведем инструкцию
        if (error.code === 'PGRST116' || error.message.includes('not found')) {
            throw new Error('Таблица уведомлений не найдена. Пожалуйста, выполните SQL-скрипт.');
        }
        throw error;
      };
      setNotifications(data || []);
      
      // Mark as read after fetching
      if (data && data.length > 0) {
        const unreadIds = data.filter(n => !n.is_read).map(n => n.id);
        if (unreadIds.length > 0) {
          await supabase
            .from('notifications')
            .update({ is_read: true })
            .in('id', unreadIds);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchNotifications();

      const channel = supabase
        .channel('notifications_realtime')
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications',
          filter: `recipient_id=eq.${session.user.id}`
        }, () => {
          fetchNotifications(false);
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [session]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart className="w-4 h-4 text-red-500 fill-current" />;
      case 'follow': return <UserPlus className="w-4 h-4 text-blue-500" />;
      case 'new_post': return <FileText className="w-4 h-4 text-emerald-500" />;
      case 'message': return <MessageSquare className="w-4 h-4 text-amber-500" />;
      default: return <Bell className="w-4 h-4 text-zinc-400" />;
    }
  };

  const getMessage = (notification: any) => {
    const username = notification.actor?.username || 'Кто-то';
    switch (notification.type) {
      case 'like': return <><b>{username}</b> оценил(а) вашу запись</>;
      case 'follow': return <><b>{username}</b> подписался(ась) на вас</>;
      case 'new_post': return <><b>{username}</b> опубликовал(а) новую запись</>;
      case 'message': return <><b>{username}</b> отправил(а) вам сообщение</>;
      default: return <>У вас новое уведомление от <b>{username}</b></>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 dark:border-zinc-700 border-t-zinc-900 dark:border-t-zinc-100"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 transition-colors">Уведомления</h1>
        {notifications.length > 0 && (
          <div className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider transition-colors">
            Последние 50
          </div>
        )}
      </div>

      {error ? (
        <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-[2rem] border border-red-100 dark:border-red-900/20 text-red-600 dark:text-red-400 text-center transition-colors">
          <p className="font-bold mb-2">Ошибка</p>
          <p className="text-sm opacity-90">{error}</p>
          {error.includes('Таблица') && (
            <div className="mt-4 p-3 bg-white/50 dark:bg-zinc-950/50 rounded-xl text-[12px] font-mono text-left overflow-x-auto transition-colors">
              {`CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id UUID REFERENCES auth.users(id),
  actor_id UUID REFERENCES auth.users(id),
  type TEXT CHECK (type IN ('like', 'follow', 'new_post')),
  post_id UUID REFERENCES posts(id),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);`}
            </div>
          )}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-[0_2px_8px_rgb(0,0,0,0.02)] transition-colors">
          <div className="mx-auto w-16 h-16 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4 border border-zinc-100 dark:border-zinc-700 transition-colors">
            <Bell className="w-6 h-6 text-zinc-300 dark:text-zinc-500" />
          </div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 transition-colors">Здесь тихо</h3>
          <p className="text-zinc-500 mt-2 text-sm px-10 transition-colors">
            Когда кто-то лайкнет ваш пост или подпишется на вас, мы сообщим здесь.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {notifications.map((n, idx) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
              >
                <Link
                  to={n.type === 'message' ? `/chat/${n.actor?.username}` : (n.type === 'follow' ? `/profile/${n.actor?.username}` : (n.post_id ? `/post/${n.post_id}` : '/'))}
                  className={`flex items-start gap-4 p-4 rounded-3xl transition-all border ${
                    n.is_read ? 'bg-white dark:bg-zinc-950 border-zinc-50 dark:border-zinc-800/50 opacity-80' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 shadow-sm ring-1 ring-zinc-100 dark:ring-zinc-800/50'
                  } hover:scale-[1.01] hover:shadow-md active:scale-[0.99]`}
                >
                  <div className="relative flex-shrink-0">
                    <div 
                      className="h-12 w-12 rounded-full flex items-center justify-center font-bold text-base shadow-sm border border-zinc-200/50 dark:border-zinc-700 overflow-hidden bg-zinc-50 dark:bg-zinc-800 text-white transition-colors"
                      style={!n.actor?.avatar_url ? generateAvatarStyle(n.actor?.username || '?') : undefined}
                    >
                      {n.actor?.avatar_url ? (
                        <img src={n.actor.avatar_url} alt={n.actor.username} className="h-full w-full object-cover" />
                      ) : (
                        getAvatarText(n.actor?.username || '?')
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-white dark:bg-zinc-900 p-1 rounded-full shadow-sm border border-zinc-100 dark:border-zinc-800 transition-colors">
                      {getIcon(n.type)}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] text-zinc-800 dark:text-zinc-200 leading-snug transition-colors">
                      {getMessage(n)}
                    </p>
                    <p className="text-[12px] text-zinc-400 dark:text-zinc-500 mt-1 font-medium transition-colors">
                      {formatDistanceToNowStrict(new Date(n.created_at), { addSuffix: true, locale: ru })}
                    </p>
                  </div>

                  {!n.is_read && (
                    <div className="w-2 h-2 bg-zinc-900 dark:bg-zinc-100 rounded-full mt-2 transition-colors" />
                  )}
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
