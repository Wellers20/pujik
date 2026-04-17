import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { Auth } from './components/Auth';
import { Navbar } from './components/Navbar';
import { Feed } from './components/Feed';
import { Profile } from './components/Profile';
import { PostPage } from './components/PostPage';
import { Hash, Sparkles } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#fafafa] text-zinc-900 font-sans pb-24 sm:pb-32">
        {session && (
          <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-zinc-100 flex items-center justify-center h-14">
            <div className="flex items-center gap-1.5 text-zinc-900">
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        
        {session && <Navbar session={session} />}
      </div>
    </BrowserRouter>
  );
}
