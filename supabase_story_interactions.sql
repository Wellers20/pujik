-- Таблица просмотров историй (Story Views)
CREATE TABLE IF NOT EXISTS story_views (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(story_id, user_id)
);

-- Таблица лайков на истории (Story Likes)
CREATE TABLE IF NOT EXISTS story_likes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(story_id, user_id)
);

-- Отключаем старые политики если есть
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert their own views" ON story_views;
DROP POLICY IF EXISTS "Stories views are viewable by everyone" ON story_views;
DROP POLICY IF EXISTS "Users can insert their own story likes" ON story_likes;
DROP POLICY IF EXISTS "Users can delete their own story likes" ON story_likes;
DROP POLICY IF EXISTS "Stories likes are viewable by everyone" ON story_likes;

-- Политики
CREATE POLICY "Users can insert their own views" 
  ON story_views FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Stories views are viewable by everyone" 
  ON story_views FOR SELECT USING (true);


CREATE POLICY "Users can insert their own story likes" 
  ON story_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own story likes" 
  ON story_likes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Stories likes are viewable by everyone" 
  ON story_likes FOR SELECT USING (true);

-- Подключим realtime
ALTER PUBLICATION supabase_realtime ADD TABLE story_views;
ALTER PUBLICATION supabase_realtime ADD TABLE story_likes;
