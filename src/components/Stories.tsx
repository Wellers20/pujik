import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { generateAvatarStyle, getAvatarText } from '../lib/utils';
import { Plus } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { useStories } from '../contexts/StoryContext';

export function Stories({ session, userProfile }: { session: any, userProfile: any }) {
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { setViewStoryForUser } = useStories();

  const fetchStories = async () => {
    try {
      const { data, error } = await supabase
        .from('stories')
        .select(`
          *,
          profiles ( username, avatar_url )
        `)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });

      if (data && !error) {
        setStories(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStories();
    const channel = supabase
      .channel('public:stories_list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, fetchStories)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session?.user) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Файл должен быть меньше 5 МБ');
      return;
    }

    setUploading(true);
    try {
      let fileToUpload: File | Blob = file;
      if (file.type.startsWith('image/')) {
        fileToUpload = await imageCompression(file, { maxSizeMB: 0.8, maxWidthOrHeight: 1600, useWebWorker: true });
      }

      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `story_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage.from('media').upload(fileName, fileToUpload);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('media').getPublicUrl(fileName);
      
      await supabase.from('stories').insert({
        user_id: session.user.id,
        media_url: data.publicUrl,
        media_type: file.type
      });
      
      await fetchStories();
      // Auto open my own newly created story
      setViewStoryForUser(session.user.id);

    } catch (error) {
      console.error('Ошибка загрузки истории:', error);
      alert('Не удалось загрузить историю. Возможно нет таблицы или бакета.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const userStories = stories.reduce((acc, story) => {
    if (!acc[story.user_id]) acc[story.user_id] = [];
    acc[story.user_id].push(story);
    return acc;
  }, {} as Record<string, any[]>);

  const usersWithStories = Object.keys(userStories).sort((a, b) => {
    if (a === session?.user?.id) return -1;
    if (b === session?.user?.id) return 1;
    const lastA = userStories[a][userStories[a].length - 1].created_at;
    const lastB = userStories[b][userStories[b].length - 1].created_at;
    return new Date(lastB).getTime() - new Date(lastA).getTime();
  });

  if (loading) return null;

  const currentUsername = userProfile?.username || 'пользователь';

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 mb-2 pt-2 scrollbar-none snap-x relative z-10 px-1">
      {session && (
        <div className="flex flex-col items-center gap-1.5 snap-start shrink-0">
          <div 
            className="relative w-16 h-16 rounded-full border border-zinc-200 dark:border-zinc-800 p-[2px] cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <div 
              className="w-full h-full rounded-full overflow-hidden bg-zinc-100 flex items-center justify-center text-zinc-400 font-bold"
              style={!userProfile?.avatar_url ? generateAvatarStyle(currentUsername) : undefined}
            >
              {uploading ? (
                <div className="w-5 h-5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin"></div>
              ) : userProfile?.avatar_url ? (
                <img src={userProfile.avatar_url} alt="My story" className="w-full h-full object-cover" />
              ) : (
                getAvatarText(currentUsername)
              )}
            </div>
            <div className="absolute bottom-0 right-0 bg-blue-500 text-white p-1 rounded-full border-2 border-white dark:border-zinc-950">
              <Plus className="w-3 h-3" strokeWidth={3} />
            </div>
          </div>
          <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 truncate w-16 text-center">Ваша</span>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleUpload} />
        </div>
      )}

      {usersWithStories.map(userId => {
        const profile = userStories[userId][0].profiles;
        const username = profile?.username || 'пользователь';
        const ringClass = "bg-gradient-to-tr from-yellow-400 via-rose-500 to-purple-500";
        
        return (
          <div 
            key={userId} 
            className="flex flex-col items-center gap-1.5 snap-start shrink-0 group cursor-pointer"
            onClick={() => setViewStoryForUser(userId)}
          >
            <div className={'w-16 h-16 rounded-full p-[2px] ' + ringClass}>
              <div className="w-full h-full rounded-full border-2 border-white dark:border-zinc-950 overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-800 dark:text-zinc-200 font-bold" style={!profile?.avatar_url ? generateAvatarStyle(username) : undefined}>
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={username} className="w-full h-full object-cover" />
                ) : (
                  getAvatarText(username)
                )}
              </div>
            </div>
            <span className="text-[11px] font-medium text-zinc-900 dark:text-zinc-200 truncate w-16 text-center">{userId === session?.user?.id ? 'Ваша' : username}</span>
          </div>
        );
      })}
    </div>
  );
}
