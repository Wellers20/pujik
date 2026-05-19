import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { generateAvatarStyle, getAvatarText } from '../lib/utils';
import { X, Trash2, Eye, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStories } from '../contexts/StoryContext';

export function StoryViewer({ session }: { session: any }) {
  const { viewStoryForUser, setViewStoryForUser } = useStories();
  const [stories, setStories] = useState<any[]>([]);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [localLikedStories, setLocalLikedStories] = useState<Set<string>>(new Set());

  // Fetch only stories we need, or all active stories
  const fetchStories = async () => {
    try {
      let { data, error } = await supabase
        .from('stories')
        .select(`
          *,
          profiles ( username, avatar_url ),
          story_views ( count ),
          story_likes ( count )
        `)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });

      if (error && error.code === 'PGRST200') {
        // Fallback for missing relations (schema cache issue or missing tables)
        const fallback = await supabase
          .from('stories')
          .select(`
            *,
            profiles ( username, avatar_url )
          `)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: true });
        
        data = fallback.data;
        error = fallback.error;
      }

      if (data && !error) {
        setStories(data);
      } else if (error) {
        console.error("StoryViewer fetch error:", error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchStories();
    const channel = supabase
      .channel('public:stories_viewer')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, fetchStories)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (viewStoryForUser) {
      setCurrentStoryIndex(0);
    }
  }, [viewStoryForUser]);

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

  const activeStoriesList = viewStoryForUser ? (userStories[viewStoryForUser] || []) : [];
  const currentStory = activeStoriesList[currentStoryIndex];

  useEffect(() => {
    if (!viewStoryForUser) return;
    const duration = currentStory?.media_type?.startsWith('video') ? null : 8000;
    if (duration) {
      const timer = setTimeout(() => nextStory(), duration);
      return () => clearTimeout(timer);
    }
  }, [viewStoryForUser, currentStoryIndex, currentStory]);

  useEffect(() => {
    if (currentStory && session?.user && currentStory.user_id !== session.user.id) {
      supabase.from('story_views').insert({
        story_id: currentStory.id,
        user_id: session.user.id
      }).then(() => {});
    }
  }, [currentStory?.id, session?.user]);

  const closeViewer = () => {
    setViewStoryForUser(null);
    setCurrentStoryIndex(0);
  };

  const handleDeleteStory = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentStory || !session?.user || currentStory.user_id !== session.user.id) return;
    if (confirm('Удалить эту историю?')) {
      await supabase.from('stories').delete().eq('id', currentStory.id);
      await fetchStories();
      closeViewer();
    }
  };

  const handleLikeStory = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentStory || !session?.user || currentStory.user_id === session.user.id) return;
    const storyId = currentStory.id;
    if (localLikedStories.has(storyId)) return;
    
    setLocalLikedStories(prev => new Set(prev).add(storyId));
    try {
      await supabase.from('story_likes').insert({
        story_id: storyId,
        user_id: session.user.id
      });
    } catch(err) {}
  };

  const nextStory = () => {
    if (!viewStoryForUser) return;
    if (currentStoryIndex < activeStoriesList.length - 1) {
      setCurrentStoryIndex(prev => prev + 1);
    } else {
      const currentUserIndex = usersWithStories.indexOf(viewStoryForUser);
      if (currentUserIndex < usersWithStories.length - 1) {
        setViewStoryForUser(usersWithStories[currentUserIndex + 1]);
        setCurrentStoryIndex(0);
      } else {
        closeViewer();
      }
    }
  };

  const prevStory = () => {
    if (!viewStoryForUser) return;
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(prev => prev - 1);
    } else {
      const currentUserIndex = usersWithStories.indexOf(viewStoryForUser);
      if (currentUserIndex > 0) {
        const prevUserId = usersWithStories[currentUserIndex - 1];
        setViewStoryForUser(prevUserId);
        setCurrentStoryIndex(userStories[prevUserId].length - 1);
      }
    }
  };

  return (
    <AnimatePresence>
      {viewStoryForUser && currentStory && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-black flex flex-col justify-center items-center"
        >
          <div className="absolute top-0 left-0 right-0 p-4 pt-6 z-20 flex gap-1.5 max-w-[500px] w-full mx-auto">
            {activeStoriesList.map((_, idx) => (
              <div key={idx} className="h-1 bg-white/30 rounded-full overflow-hidden flex-1">
                <div 
                  className="h-full bg-white transition-all duration-100 ease-linear"
                  style={{ 
                    width: idx < currentStoryIndex ? '100%' : idx === currentStoryIndex ? '100%' : '0%',
                    transitionDuration: idx === currentStoryIndex && !currentStory.media_type?.startsWith('video') ? '5s' : '0s'
                  }}
                />
              </div>
            ))}
          </div>

          <div className="absolute top-10 left-0 right-0 p-4 z-20 flex items-center justify-between max-w-[500px] w-full mx-auto">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-full border border-white/20 overflow-hidden flex items-center justify-center font-bold text-white bg-zinc-800"
                style={!currentStory.profiles?.avatar_url ? generateAvatarStyle(currentStory.profiles?.username) : undefined}
              >
                {currentStory.profiles?.avatar_url ? (
                  <img src={currentStory.profiles.avatar_url} className="w-full h-full object-cover" />
                ) : (
                  getAvatarText(currentStory.profiles?.username)
                )}
              </div>
              <span className="text-white font-bold text-[15px] drop-shadow-md">{currentStory.profiles?.username}</span>
            </div>
            
             <button onClick={closeViewer} className="p-2 bg-black/20 hover:bg-black/40 rounded-full text-white backdrop-blur-md transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="w-full max-w-[500px] h-full sm:h-[90vh] sm:rounded-3xl overflow-hidden relative flex items-center justify-center bg-zinc-950 group/viewer">
            {currentStory.media_type?.startsWith('video') ? (
              <video 
                src={currentStory.media_url} 
                autoPlay 
                controls={false}
                onEnded={nextStory}
                className="w-full h-full object-contain"
              />
            ) : (
              <img 
                src={currentStory.media_url} 
                className="w-full h-full object-contain"
                alt="Story"
              />
            )}
            
            <div className="absolute inset-y-0 left-0 w-1/3 z-10" onClick={prevStory} />
            <div className="absolute inset-y-0 right-0 w-2/3 z-10" onClick={nextStory} />

            <div className="absolute bottom-4 left-0 right-0 p-4 z-30 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent">
              {currentStory.user_id === session?.user?.id ? (
                <div className="flex w-full items-center justify-between text-white drop-shadow-md px-2">
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1.5 font-semibold text-sm">
                      <Eye className="w-5 h-5 text-zinc-300" />
                      {currentStory.story_views?.[0]?.count || 0}
                    </div>
                    <div className="flex items-center gap-1.5 font-semibold text-sm">
                      <Heart className="w-5 h-5 text-rose-400" />
                      {currentStory.story_likes?.[0]?.count || 0}
                    </div>
                  </div>
                  <button 
                    onClick={handleDeleteStory} 
                    className="p-2.5 bg-black/40 hover:bg-red-500/80 rounded-full backdrop-blur-md transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex w-full justify-end px-2">
                  <button 
                    onClick={handleLikeStory}
                    className="p-3 bg-black/40 hover:bg-black/60 rounded-full backdrop-blur-md transition-colors"
                  >
                    <Heart className={`w-6 h-6 ${localLikedStories.has(currentStory.id) ? 'fill-rose-500 text-rose-500' : 'text-white group-active/viewer:scale-90 transition-transform'}`} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
