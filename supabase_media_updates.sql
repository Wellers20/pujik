-- Добавляем новые колонки в таблицы
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_type TEXT;

-- Создаем бакеты для хранения файлов
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true) ON CONFLICT DO NOTHING;

-- Политики безопасности для аватарок
DROP POLICY IF EXISTS "Avatar images are publicly accessible." ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible." ON storage.objects FOR SELECT USING ( bucket_id = 'avatars' );

DROP POLICY IF EXISTS "Anyone can upload an avatar." ON storage.objects;
CREATE POLICY "Anyone can upload an avatar." ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'avatars' );

DROP POLICY IF EXISTS "Anyone can update an avatar." ON storage.objects;
CREATE POLICY "Anyone can update an avatar." ON storage.objects FOR UPDATE WITH CHECK ( bucket_id = 'avatars' );

-- Политики безопасности для медиа файлов постов
DROP POLICY IF EXISTS "Media are publicly accessible." ON storage.objects;
CREATE POLICY "Media are publicly accessible." ON storage.objects FOR SELECT USING ( bucket_id = 'media' );

DROP POLICY IF EXISTS "Anyone can upload media." ON storage.objects;
CREATE POLICY "Anyone can upload media." ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'media' );

DROP POLICY IF EXISTS "Anyone can delete media." ON storage.objects;
CREATE POLICY "Anyone can delete media." ON storage.objects FOR DELETE USING ( bucket_id = 'media' );
