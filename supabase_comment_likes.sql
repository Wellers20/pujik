-- 1. Добавляем таблицу лайков для комментариев
CREATE TABLE IF NOT EXISTS comment_likes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(comment_id, user_id)
);

-- 2. Включаем RLS
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

-- 3. Политики безопасности для лайков комментариев
DROP POLICY IF EXISTS "Comment likes viewable by everyone" ON comment_likes;
CREATE POLICY "Comment likes viewable by everyone" ON comment_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own comment likes" ON comment_likes;
CREATE POLICY "Users can insert their own comment likes" ON comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own comment likes" ON comment_likes;
CREATE POLICY "Users can delete their own comment likes" ON comment_likes FOR DELETE USING (auth.uid() = user_id);

-- 4. ВАЖНЫЙ ФИКС: Гарантируем, что лайки удаляются вместе с постами
-- Это решит проблему "тихого" не-удаления поста из-за блокировки внешними ключами.
ALTER TABLE likes
  DROP CONSTRAINT IF EXISTS likes_post_id_fkey,
  ADD CONSTRAINT likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE;
