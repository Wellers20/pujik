import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Post } from './Post';
import { CreatePost } from './CreatePost';
import { Hash, Users } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

export function Feed({ session }: { session: any }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [hasProfile, setHasProfile] = useState<boolean>(true);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  
  // Tab state: 'global' | 'following'
  const [feedType, setFeedType] = useState<'global' | 'following'>('global');

  const fetchProfileAndPosts = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      
      // Fetch admins globally so we can display badges and manage permissions locally
      try {
        const { data: adminsData } = await supabase.from('admins').select('user_id');
        if (adminsData) {
          setAdminIds(new Set(adminsData.map(a => a.user_id)));
        }
      } catch (e) {
        // Safe fail if admins table is missing
      }

      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (profile) {
          setUserProfile(profile);
          setHasProfile(true);
        } else {
          setHasProfile(false);
        }
      }

      let query = supabase
        .from('posts')
        .select(`
          *,
          profiles ( username, avatar_url ),
          likes ( count ),
          comments ( count )
        `)
        .order('created_at', { ascending: false });

      // Если выбрана вкладка "Подписки", фильтруем посты
      if (feedType === 'following' && session?.user) {
        const { data: follows } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', session.user.id);
          
        const followingIds = follows?.map(f => f.following_id) || [];
        
        // Включаем посты тех на кого подписаны + собственные посты
        query = query.in('user_id', [...followingIds, session.user.id]);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPosts(data || []);
    } catch (err: any) {
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileAndPosts();

    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        // Фоновое обновление, чтобы страница не перезагружалась
        fetchProfileAndPosts(true); 
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, feedType]); // Refetch when tab changes

  const handlePostDeleted = (id: string) => {
    setPosts(prev => prev.filter(p => p.id !== id));
  }

  const currentUserIsAdmin = session?.user && adminIds.has(session.user.id);

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      {session && (
        <div className="mb-2">
          {hasProfile ? (
            <CreatePost user={session.user} userProfile={userProfile} onPostCreated={fetchProfileAndPosts} />
          ) : (
            <div className="bg-amber-50 p-5 rounded-3xl border border-amber-200 text-amber-900 text-sm mb-6 flex items-start gap-3">
              <span className="text-xl leading-none">⚠️</span>
              <div>
                <strong className="block mb-0.5 text-[15px]">Профиль в процессе создания</strong>
                <span className="opacity-90">Ваш аккаунт зарегистрирован, но профиль еще записывается в базу. Попробуйте обновить страницу.</span>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Feed Tabs */}
      {session && (
        <div className="flex border-b border-zinc-200 mb-6 sticky top-14 bg-[#fafafa]/80 backdrop-blur-md z-30 pt-2 px-1">
          <button 
            onClick={() => setFeedType('global')}
            className={cn(
              "pb-3 px-6 text-[15px] font-bold transition-colors relative",
              feedType === 'global' ? "text-zinc-900" : "text-zinc-500 hover:text-zinc-800"
            )}
          >
            Для вас
            {feedType === 'global' && (
              <motion.div layoutId="feedTabIndicator" className="absolute bottom-0 left-0 right-0 h-[3px] bg-zinc-900 rounded-t-full" />
            )}
          </button>
          
          <button 
            onClick={() => setFeedType('following')}
            className={cn(
              "pb-3 px-6 text-[15px] font-bold transition-colors relative",
              feedType === 'following' ? "text-zinc-900" : "text-zinc-500 hover:text-zinc-800"
            )}
          >
            Подписки
            {feedType === 'following' && (
              <motion.div layoutId="feedTabIndicator" className="absolute bottom-0 left-0 right-0 h-[3px] bg-zinc-900 rounded-t-full" />
            )}
          </button>
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center p-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900"></div>
        </div>
      ) : error ? (
        <div className="mx-auto max-w-xl bg-red-50 p-4 rounded-2xl border border-red-100 text-red-600 text-center text-sm font-medium">
          Не удалось загрузить ленту: {error}
        </div>
      ) : (
        <div className="space-y-0 relative">
          {posts.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-zinc-100 shadow-[0_2px_8px_rgb(0,0,0,0.02)] mt-4">
              <div className="mx-auto w-12 h-12 bg-zinc-50 rounded-full flex items-center justify-center mb-4 border border-zinc-100">
                {feedType === 'global' ? <Hash className="w-5 h-5 text-zinc-400" /> : <Users className="w-5 h-5 text-zinc-400" />}
              </div>
              <h3 className="text-lg font-bold text-zinc-900">
                {feedType === 'following' ? 'Вы ни на кого не подписаны' : 'Здесь пока пусто'}
              </h3>
              <p className="text-zinc-500 mt-2 text-sm px-8">
                {feedType === 'following' 
                  ? 'Перейдите во вкладку "Для вас" и найдите интересных людей.' 
                  : 'Создайте первую запись, чтобы начать обсуждение в этой сети.'}
              </p>
            </div>
          ) : (
            posts.map((post) => (
              <Post 
                key={post.id} 
                post={post} 
                currentUser={session?.user} 
                onPostDeleted={handlePostDeleted} 
                adminIds={adminIds} 
                currentUserIsAdmin={currentUserIsAdmin}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
