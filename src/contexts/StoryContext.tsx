import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface StoryContextType {
  activeStoryUsers: Set<string>;
  viewStoryForUser: string | null;
  setViewStoryForUser: (userId: string | null) => void;
}

const StoryContext = createContext<StoryContextType>({ 
  activeStoryUsers: new Set(),
  viewStoryForUser: null,
  setViewStoryForUser: () => {}
});

export const useStories = () => useContext(StoryContext);

export function StoryProvider({ children }: { children: React.ReactNode }) {
  const [activeStoryUsers, setActiveStoryUsers] = useState<Set<string>>(new Set());
  const [viewStoryForUser, setViewStoryForUser] = useState<string | null>(null);

  useEffect(() => {
    const fetchActiveStories = async () => {
      try {
        const { data, error } = await supabase
          .from('stories')
          .select('user_id')
          .gt('expires_at', new Date().toISOString());

        if (data && !error) {
          const userIds = new Set(data.map(d => d.user_id));
          setActiveStoryUsers(userIds);
        }
      } catch (e) {
        // ignore
      }
    };

    fetchActiveStories();

    // Subscribe to changes in stories table
    const channel = supabase
      .channel('public:stories_global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, fetchActiveStories)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <StoryContext.Provider value={{ activeStoryUsers, viewStoryForUser, setViewStoryForUser }}>
      {children}
    </StoryContext.Provider>
  );
}
