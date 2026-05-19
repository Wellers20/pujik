-- Таблица комментариев
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) <= 300),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Включаем RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Политики безопасности для комментариев
DROP POLICY IF EXISTS "Comments are viewable by everyone." ON comments;
CREATE POLICY "Comments are viewable by everyone." ON comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert comments." ON comments;
CREATE POLICY "Authenticated users can insert comments." ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own comments." ON comments;
CREATE POLICY "Users can delete own comments." ON comments FOR DELETE USING (auth.uid() = user_id);

-- Добавляем таблицу комментариев в публикацию для Realtime (если нужно отслеживать события)
begin;
  -- Пытаемся удалить старую, если есть, или просто добавляем.
  -- Для безопасности просто добавим таблицу:
  ALTER PUBLICATION supabase_realtime ADD TABLE comments;
commit;
