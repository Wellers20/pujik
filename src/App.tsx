import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { Auth } from './components/Auth';
import { Navbar } from './components/Navbar';
import { Feed } from './components/Feed';
import { Profile } from './components/Profile';
import { PostPage } from './components/PostPage';
import { Notifications } from './components/Notifications';
import { Search } from './components/Search';
import { Messages } from './components/Messages';
import { Chat } from './components/Chat';
import { AdminPanel } from './components/AdminPanel';
import { Hash, Sparkles } from 'lucide-react';
import { cn } from './lib/utils';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [darkMode]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900"></div>
      </div>
    );
  }

  const isChatRoute = location.pathname.startsWith('/chat/');

  return (
    <div className={cn(
      "min-h-screen bg-[#fafafa] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans transition-colors duration-300",
      session && !isChatRoute ? "pb-24 sm:pb-32" : ""
    )}>
      {session && !isChatRoute && (
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-center h-14 transition-colors duration-300">
          <div className="flex items-center gap-1.5 text-zinc-900 dark:text-zinc-50 transition-colors duration-300">
             <Hash className="w-5 h-5" />
             <span className="font-extrabold tracking-tight text-lg">Connect</span>
          </div>
        </header>
      )}
      <main>
        <Routes>
            <Route 
              path="/" 
              element={session ? <Feed session={session} /> : <Auth onAuthSuccess={() => {}} />} 
            />
            <Route 
              path="/profile/:username" 
              element={session ? <Profile session={session} /> : <Navigate to="/" />} 
            />
            <Route 
              path="/post/:id" 
              element={session ? <PostPage session={session} /> : <Navigate to="/" />} 
            />
            <Route 
              path="/notifications" 
              element={session ? <Notifications session={session} /> : <Navigate to="/" />} 
            />
            <Route 
              path="/search" 
              element={session ? <Search session={session} /> : <Navigate to="/" />} 
            />
            <Route 
              path="/messages" 
              element={session ? <Messages session={session} /> : <Navigate to="/" />} 
            />
            <Route 
              path="/chat/:username" 
              element={session ? <Chat session={session} /> : <Navigate to="/" />} 
            />
            <Route 
              path="/admin" 
              element={session ? <AdminPanel session={session} /> : <Navigate to="/" />} 
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        
        {session && <Navbar session={session} />}
      </div>
    );
  }
