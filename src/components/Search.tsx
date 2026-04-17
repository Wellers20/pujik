import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Link, useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, Hash, User } from 'lucide-react';
import { generateAvatarStyle, getAvatarText } from '../lib/utils';
import { Post } from './Post';

export function Search({ session }: { session: any }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [activeTab, setActiveTab] = useState<'users' | 'posts'>(query.startsWith('#') || searchParams.get('q')?.startsWith('#') ? 'posts' : 'users');
  const [users, setUsers] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query) {
      if (query !== searchParams.get('q')) {
        setSearchParams({ q: query });
      }
      const delayDebounceFn = setTimeout(() => {
        performSearch();
      }, 500);
      return () => clearTimeout(delayDebounceFn);
    } else {
      setSearchParams({});
      setUsers([]);
      setPosts([]);
    }
  }, [query, activeTab]);

  useEffect(() => {
    // Sync URL queries
    if (searchParams.get('q') && searchParams.get('q') !== query) {
      setQuery(searchParams.get('q') || '');
      if (searchParams.get('q')?.startsWith('#')) setActiveTab('posts');
    }
  }, [searchParams]);

  const performSearch = async () => {
    setLoading(true);
    try {
      if (activeTab === 'users') {
        const { data } = await supabase.from('profiles').select('*').ilike('username', `%${query}%`).limit(20);
        setUsers(data || []);
      } else {
        const { data } = await supabase
          .from('posts')
          .select('*, profiles(username, avatar_url), likes(count), comments(count)')
          .ilike('content', `%${query}%`)
          .order('created_at', { ascending: false })
          .limit(20);
        setPosts(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <div className="relative mb-6">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 w-5 h-5 transition-colors" />
        <input 
          type="text" 
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearchParams({ q: e.target.value });
            if (e.target.value.startsWith('#')) setActiveTab('posts');
          }}
          placeholder="Поиск людей или #хэштегов" 
          className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[24px] py-3.5 pl-12 pr-4 text-[15px] font-medium focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-50 focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-50 shadow-sm transition-colors dark:text-zinc-50 dark:placeholder:text-zinc-500"
        />
      </div>
      
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 mb-6 transition-colors">
        <button 
          onClick={() => setActiveTab('users')} 
          className={`pb-3 px-6 text-[15px] font-bold transition-colors ${activeTab === 'users' ? 'text-zinc-900 dark:text-zinc-50 border-b-2 border-zinc-900 dark:border-zinc-50' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
        >
          Люди
        </button>
        <button 
          onClick={() => setActiveTab('posts')} 
          className={`pb-3 px-6 text-[15px] font-bold transition-colors ${activeTab === 'posts' ? 'text-zinc-900 dark:text-zinc-50 border-b-2 border-zinc-900 dark:border-zinc-50' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
        >
          Записи
        </button>
      </div>

      <div>
          {loading ? (
            <div className="flex justify-center p-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 dark:border-zinc-700 border-t-zinc-900 dark:border-t-zinc-100"></div>
            </div>
          ) : activeTab === 'users' ? (
            <div className="space-y-3">
              {users.length === 0 && query && <div className="text-center text-zinc-500 py-10 font-medium">Ничего не найдено</div>}
              {!query && <div className="text-center text-zinc-400 dark:text-zinc-600 text-sm py-10 transition-colors">Начните вводить никнейм...</div>}
              {users.map(u => (
                <Link key={u.id} to={`/profile/${u.username}`} className="flex items-center gap-3 p-4 bg-white dark:bg-zinc-900 rounded-[24px] border border-zinc-100 dark:border-zinc-800 shadow-sm hover:border-zinc-200 dark:hover:border-zinc-700 transition-colors">
                  <div className="h-12 w-12 rounded-full border border-zinc-200/50 dark:border-zinc-700 overflow-hidden flex items-center justify-center font-bold text-lg bg-zinc-50 dark:bg-zinc-800 shadow-sm text-white" style={!u.avatar_url ? generateAvatarStyle(u.username) : undefined}>
                    {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : getAvatarText(u.username)}
                  </div>
                  <span className="font-bold text-[16px] text-zinc-900 dark:text-zinc-50">{u.username}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="space-y-0 relative">
              {posts.length === 0 && query && <div className="text-center text-zinc-500 py-10 font-medium">Записи не найдены</div>}
              {!query && <div className="text-center text-zinc-400 dark:text-zinc-600 text-sm py-10 transition-colors">Введите слово или #хэштег...</div>}
              {posts.map(p => <Post key={p.id} post={p} currentUser={session?.user} />)}
            </div>
          )}
      </div>
    </div>
  );
}
