import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Post } from './Post';
import { ArrowLeft } from 'lucide-react';

export function PostPage({ session }: { session: any }) {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPost = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles ( username, avatar_url ),
          likes ( count ),
          comments ( count )
        `)
        .eq('id', id)
        .single();

      if (!error && data) {
        setPost(data);
      }
      setLoading(false);
    };

    if (id) fetchPost();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 dark:border-zinc-700 border-t-zinc-900 dark:border-t-zinc-100"></div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-xl text-center py-20 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm mt-12 transition-colors">
         <h2 className="text-xl font-bold dark:text-zinc-50">Пост не найден</h2>
         <button onClick={() => navigate('/')} className="mt-4 text-zinc-500 dark:text-zinc-400 font-bold hover:underline transition-colors">Вернуться на главную</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <button 
        onClick={() => {
          if (window.history.state && window.history.state.idx > 0) {
            navigate(-1);
          } else {
            navigate('/');
          }
        }} 
        className="flex items-center gap-2 mb-6 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 font-bold transition-all"
      >
        <ArrowLeft className="w-5 h-5" />
        Назад
      </button>

      <Post post={post} currentUser={session?.user} isDetailView={true} onPostDeleted={() => navigate('/')} />
    </div>
  );
}
