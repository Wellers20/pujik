import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Home, User, Bell, Search, MessageSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export function Navbar({ session }: { session: any }) {
  const [profile, setProfile] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    if (session?.user) {
      supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
        .then(({ data }) => {
          if (data) setProfile(data);
        });

      // Fetch unread notifications count
      const fetchUnread = async () => {
        const { count } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('recipient_id', session.user.id)
          .eq('is_read', false);
        setUnreadCount(count || 0);
      };

      fetchUnread();

      // Listen for new notifications and updates
      const channel = supabase
        .channel('notifications-badge')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'notifications', 
          filter: `recipient_id=eq.${session.user.id}` 
        }, () => {
          fetchUnread();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [session]);

  if (!session || location.pathname.startsWith('/chat/')) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 sm:bottom-6 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[420px] transition-all pb-safe">
      <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border-t sm:border border-zinc-200 dark:border-zinc-800 sm:rounded-full shadow-[0_-4px_20px_rgba(0,0,0,0.02)] sm:shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:shadow-none transition-colors">
        <div className="flex justify-around items-center h-16 sm:h-14 px-4">
          
          <Link 
            to="/" 
            className={cn(
              "flex flex-[0.2] justify-center items-center gap-1.5 px-3 py-2 rounded-full transition-all relative overflow-hidden",
              location.pathname === '/' ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
            )}
          >
            {location.pathname === '/' && (
               <motion.div layoutId="nav-bg" className="absolute inset-0 bg-zinc-100 dark:bg-zinc-800 rounded-full z-0 transition-colors" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
            )}
            <div className="relative z-10">
              <Home className="h-[22px] w-[22px] sm:h-[22px] sm:w-[22px]" strokeWidth={location.pathname === '/' ? 2.5 : 2} />
            </div>
          </Link>

          <Link 
            to="/search" 
            className={cn(
              "flex flex-[0.2] justify-center items-center gap-1.5 px-3 py-2 rounded-full transition-all relative overflow-hidden",
              location.pathname === '/search' ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
            )}
          >
            {location.pathname === '/search' && (
               <motion.div layoutId="nav-bg" className="absolute inset-0 bg-zinc-100 dark:bg-zinc-800 rounded-full z-0 transition-colors" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
            )}
            <div className="relative z-10">
              <Search className="h-[22px] w-[22px] sm:h-[22px] sm:w-[22px]" strokeWidth={location.pathname === '/search' ? 2.5 : 2} />
            </div>
          </Link>

          <Link 
            to="/messages" 
            className={cn(
              "flex flex-[0.2] justify-center items-center gap-1.5 px-3 py-2 rounded-full transition-all relative overflow-hidden",
              location.pathname.startsWith('/messages') || location.pathname.startsWith('/chat') ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
            )}
          >
            {(location.pathname.startsWith('/messages') || location.pathname.startsWith('/chat')) && (
               <motion.div layoutId="nav-bg" className="absolute inset-0 bg-zinc-100 dark:bg-zinc-800 rounded-full z-0 transition-colors" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
            )}
            <div className="relative z-10">
              <MessageSquare className="h-[22px] w-[22px] sm:h-[22px] sm:w-[22px]" strokeWidth={(location.pathname.startsWith('/messages') || location.pathname.startsWith('/chat')) ? 2.5 : 2} />
            </div>
          </Link>

          <Link 
            to="/notifications" 
            className={cn(
              "flex flex-[0.2] justify-center items-center gap-1.5 px-3 py-2 rounded-full transition-all relative overflow-hidden",
              location.pathname === '/notifications' ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
            )}
          >
            {location.pathname === '/notifications' && (
               <motion.div layoutId="nav-bg" className="absolute inset-0 bg-zinc-100 dark:bg-zinc-800 rounded-full z-0 transition-colors" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
            )}
            <div className="relative z-10">
              <Bell className="h-[22px] w-[22px] sm:h-[22px] sm:w-[22px]" strokeWidth={location.pathname === '/notifications' ? 2.5 : 2} />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-900 transition-colors">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
          </Link>
          
          {profile && (
            <Link 
              to={`/profile/${profile.username}`} 
              className={cn(
                "flex flex-[0.2] justify-center items-center gap-1.5 px-3 py-2 rounded-full transition-all relative overflow-hidden",
                location.pathname === `/profile/${profile.username}` ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
              )}
            >
              {location.pathname === `/profile/${profile.username}` && (
                 <motion.div layoutId="nav-bg" className="absolute inset-0 bg-zinc-100 dark:bg-zinc-800 rounded-full z-0 transition-colors" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
              )}
              <div className="relative z-10">
                <User className="h-[22px] w-[22px] sm:h-[22px] sm:w-[22px]" strokeWidth={location.pathname === `/profile/${profile.username}` ? 2.5 : 2} />
              </div>
            </Link>
          )}

        </div>
      </div>
    </nav>
  );
}
