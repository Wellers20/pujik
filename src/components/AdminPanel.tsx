import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Trash2, UserX, UserCheck, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function AdminPanel({ session }: { session: any }) {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ users: 0, posts: 0, comments: 0 });

  useEffect(() => {
    const checkAdmin = async () => {
      if (!session?.user) {
        navigate('/');
        return;
      }

      const { data, error } = await supabase
        .from('admins')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (error || !data) {
        setIsAdmin(false);
        navigate('/');
        return;
      }

      setIsAdmin(true);
      fetchData();
    };

    checkAdmin();
  }, [session, navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch stats
      const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      const { count: postCount } = await supabase.from('posts').select('*', { count: 'exact', head: true });
      const { count: commentCount } = await supabase.from('comments').select('*', { count: 'exact', head: true });
      
      setStats({
        users: userCount || 0,
        posts: postCount || 0,
        comments: commentCount || 0
      });

      // Fetch recent users with their admin status
      const { data: userData } = await supabase
        .from('profiles')
        .select(`
          *,
          admins(user_id)
        `)
        .order('id', { ascending: false })
        .limit(20);
      setUsers(userData || []);

      // Fetch recent posts
      const { data: postData } = await supabase
        .from('posts')
        .select('*, profiles(username)')
        .order('created_at', { ascending: false })
        .limit(20);
      setPosts(postData || []);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const deletePost = async (id: string) => {
    if (!confirm('Удалить пост навсегда?')) return;
    const { error } = await supabase.from('posts').delete().eq('id', id);
    if (!error) fetchData();
  };

  const toggleAdmin = async (userId: string, currentlyAdmin: boolean) => {
    if (currentlyAdmin) {
       await supabase.from('admins').delete().eq('user_id', userId);
    } else {
       await supabase.from('admins').insert({ user_id: userId });
    }
    fetchData();
  };

  if (isAdmin === null || loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 dark:border-zinc-700 border-t-zinc-900 dark:border-t-zinc-100"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-amber-100 p-2 rounded-xl text-amber-600">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">Панель управления</h1>
            <p className="text-sm text-zinc-500 font-medium">Модерация контента и пользователей</p>
          </div>
        </div>
        <button 
          onClick={() => {
            if (window.history.state && window.history.state.idx > 0) {
              navigate(-1);
            } else {
              navigate('/');
            }
          }}
          className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 rounded-xl font-bold text-sm hover:bg-zinc-200 transition-all"
        >
          Назад
        </button>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm transition-colors">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Пользователи</p>
          <p className="text-3xl font-black text-zinc-900 dark:text-zinc-50 tracking-tighter">{stats.users}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm transition-colors">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Посты</p>
          <p className="text-3xl font-black text-zinc-900 dark:text-zinc-50 tracking-tighter">{stats.posts}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm transition-colors">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Комментарии</p>
          <p className="text-3xl font-black text-zinc-900 dark:text-zinc-50 tracking-tighter">{stats.comments}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Список пользователей */}
        <section>
          <h2 className="text-lg font-bold mb-4 px-1 dark:text-zinc-50">Недавние пользователи</h2>
          <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden transition-colors">
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 transition-colors">
              {users.map(u => {
                const isUserAdmin = !!u.admins?.[0];
                return (
                  <div key={u.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-bold text-zinc-400">
                        {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full rounded-full object-cover" /> : u.username[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">@{u.username}</p>
                          {isUserAdmin && <Shield className="w-3 h-3 text-amber-500" fill="currentColor" />}
                        </div>
                        <p className="text-[11px] text-zinc-500 font-mono">{u.id.substring(0, 8)}...</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => toggleAdmin(u.id, isUserAdmin)}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          isUserAdmin 
                            ? "text-amber-500 bg-amber-50 dark:bg-amber-900/10 hover:bg-amber-100" 
                            : "text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        )}
                        title={isUserAdmin ? "Убрать админа" : "Назначить админа"}
                      >
                        <UserCheck className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Список постов */}
        <section>
          <h2 className="text-lg font-bold mb-4 px-1 dark:text-zinc-50">Последние пульсы</h2>
          <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {posts.map(p => (
                <div key={p.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-[11px] font-bold text-zinc-400">@{p.profiles?.username}</span>
                    <button 
                      onClick={() => deletePost(p.id)}
                      className="p-1.5 bg-red-50 dark:bg-red-900/10 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[13px] text-zinc-700 dark:text-zinc-300 line-clamp-2 leading-relaxed">
                    {p.content || 'Медиа-файл'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="mt-12 p-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-[2rem] flex items-start gap-4">
        <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />
        <div>
          <h4 className="font-bold text-amber-900 dark:text-amber-100 mb-1">Осторожно</h4>
          <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
            Вы имеете полный доступ к удалению контента. Действия необратимы. Все удаления записываются в лог системы (если настроено).
          </p>
        </div>
      </div>
    </div>
  );
}
