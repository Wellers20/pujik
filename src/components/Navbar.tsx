import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Home, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export function Navbar({ session }: { session: any }) {
  const [profile, setProfile] = useState<any>(null);
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
    }
  }, [session]);

  if (!session) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 sm:bottom-6 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[320px] transition-all pb-safe">
      <div className="bg-white/90 backdrop-blur-xl border-t sm:border border-zinc-200 sm:rounded-full shadow-[0_-4px_20px_rgba(0,0,0,0.02)] sm:shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
        <div className="flex justify-around items-center h-16 sm:h-14 px-4">
          
          <Link 
            to="/" 
            className={cn(
              "flex flex-[0.5] justify-center items-center gap-1.5 px-4 py-2 rounded-full transition-all relative overflow-hidden",
              location.pathname === '/' ? "text-zinc-900" : "text-zinc-400 hover:text-zinc-900"
            )}
          >
            {location.pathname === '/' && (
               <motion.div layoutId="nav-bg" className="absolute inset-0 bg-zinc-100 rounded-full z-0" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
            )}
            <div className="relative z-10">
              <Home className="h-6 w-6 sm:h-[22px] sm:w-[22px]" strokeWidth={location.pathname === '/' ? 2.5 : 2} />
            </div>
          </Link>
          
          {profile && (
            <Link 
              to={`/profile/${profile.username}`} 
              className={cn(
                "flex flex-[0.5] justify-center items-center gap-1.5 px-4 py-2 rounded-full transition-all relative overflow-hidden",
                location.pathname.includes('/profile/') ? "text-zinc-900" : "text-zinc-400 hover:text-zinc-900"
              )}
            >
              {location.pathname.includes('/profile/') && (
                 <motion.div layoutId="nav-bg" className="absolute inset-0 bg-zinc-100 rounded-full z-0" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />
              )}
              <div className="relative z-10">
                <User className="h-6 w-6 sm:h-[22px] sm:w-[22px]" strokeWidth={location.pathname.includes('/profile/') ? 2.5 : 2} />
              </div>
            </Link>
          )}

        </div>
      </div>
    </nav>
  );
}
