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
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900"></div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-xl text-center py-20 bg-white rounded-3xl border border-zinc-100 shadow-sm mt-12">
         <h2 className="text-xl font-bold">Пост не найден</h2>
         <button onClick={() => navigate('/')} className="mt-4 text-zinc-500 font-bold hover:underline">Вернуться на главную</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <button 
        onClick={() => navigate(-1)} 
        className="flex items-center gap-2 mb-6 text-zinc-500 hover:text-zinc-900 font-bold transition-all"
      >
        <ArrowLeft className="w-5 h-5" />
        Назад
      </button>

      <Post post={post} currentUser={session?.user} isDetailView={true} onPostDeleted={() => navigate('/')} />
    </div>
  );
}
