import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { generateAvatarStyle, getAvatarText } from '../lib/utils';
import { Image as ImageIcon, X, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function CreatePost({ user, userProfile, onPostCreated }: { user: any, userProfile: any, onPostCreated: () => void }) {
  const [content, setContent] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFullscreenPreview, setShowFullscreenPreview] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate preview URL when a file is selected
  useEffect(() => {
    if (!mediaFile) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(mediaFile);
    setPreviewUrl(objectUrl);
    
    // Cleanup to prevent memory leaks
    return () => URL.revokeObjectURL(objectUrl);
  }, [mediaFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Limit to 5MB
      if (file.size > 5 * 1024 * 1024) {
        setError('Файл должен быть меньше 5 МБ');
        return;
      }
      setError(null);
      setMediaFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!content.trim() && !mediaFile) || !user) return;
    if (content.length > 500) {
      setError('Текст не должен превышать 500 символов');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let media_url = null;
      let media_type = null;

      // 1. Upload media if present
      if (mediaFile) {
        const fileExt = mediaFile.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(fileName, mediaFile);

        if (uploadError) throw new Error('Не удалось загрузить файл (возможно бакет media не настроен)');

        const { data } = supabase.storage.from('media').getPublicUrl(fileName);
        media_url = data.publicUrl;
        media_type = mediaFile.type;
      }

      // 2. Create post
      const { error: insertError } = await supabase
        .from('posts')
        .insert([{ 
          user_id: user.id, 
          content: content.trim(),
          media_url,
          media_type
        }]);

      if (insertError) throw insertError;

      setContent('');
      setMediaFile(null);
      setShowFullscreenPreview(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onPostCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const username = userProfile?.username || 'пользователь';

  return (
    <>
      <div className="bg-white p-5 rounded-3xl shadow-[0_2px_12px_rgb(0,0,0,0.03)] border border-zinc-100 mb-6 flex gap-4 transition-all focus-within:ring-1 focus-within:ring-zinc-200 focus-within:border-zinc-300 relative z-10">
        <div className="flex-shrink-0 pt-1">
          <div 
            className="h-11 w-11 rounded-full flex items-center justify-center font-bold text-base shadow-sm border border-zinc-200/50 overflow-hidden bg-zinc-50"
            style={!userProfile?.avatar_url ? generateAvatarStyle(username) : undefined}
          >
            {userProfile?.avatar_url ? (
              <img src={userProfile.avatar_url} alt={username} className="h-full w-full object-cover" />
            ) : (
              getAvatarText(username)
            )}
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 min-w-0">
          <textarea
            className="w-full resize-none border-0 bg-transparent p-0 pt-2.5 text-zinc-900 placeholder:text-zinc-400 focus:ring-0 text-[17px] leading-relaxed"
            rows={(content.split('\n').length > 1 || content.length > 50 || mediaFile) ? 3 : 1}
            placeholder="Что нового?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={500}
          />

          {previewUrl && mediaFile && (
            <div className="mt-2 mb-2 flex justify-start">
              <div 
                className="relative w-16 h-16 rounded-xl overflow-hidden border border-zinc-200/80 cursor-pointer group shadow-sm bg-zinc-50"
                onClick={() => setShowFullscreenPreview(true)}
              >
                {mediaFile.type.startsWith('video/') ? (
                  <>
                    <video src={previewUrl} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center transition-colors group-hover:bg-black/30">
                      <div className="w-6 h-6 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center">
                        <Play className="w-2.5 h-2.5 text-white ml-0.5" fill="currentColor" />
                      </div>
                    </div>
                  </>
                ) : (
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMediaFile(null);
                    setShowFullscreenPreview(false);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="absolute top-1 right-1 p-0.5 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-full text-white transition-colors z-10"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
          
          {error && (
            <div className="mt-2 text-[14px] text-red-500 font-medium pb-2 border-b border-zinc-50 leading-tight">
              {error}
              {error.includes('бакет media') && <p className="text-xs text-red-400 mt-1">Обязательно выполните SQL скрипт создания бакетов.</p>}
            </div>
          )}

          <div className="flex items-center justify-between pt-3 mt-1 relative border-t border-zinc-50">
            
            <div className="flex items-center gap-3">
               <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  accept="image/*,video/*"
                  onChange={handleFileChange}
               />
               <button
                 type="button"
                 onClick={() => fileInputRef.current?.click()}
                 className="px-3.5 py-2 text-zinc-600 bg-zinc-100 hover:bg-zinc-200 hover:text-zinc-900 rounded-full transition-colors flex items-center justify-center gap-2 active:scale-95 font-semibold text-[13px]"
                 title="Прикрепить фото или видео"
               >
                  <ImageIcon className="w-[18px] h-[18px]" />
                  <span className="hidden sm:inline">Медиа</span>
               </button>
            </div>
            
            <div className="flex items-center gap-4">
              {content.length > 0 && (
                <div className="text-[13px] font-medium text-zinc-400">
                  <span className={content.length > 450 ? "text-amber-500" : ""}>
                    {content.length}
                  </span>
                  <span className="opacity-50"> / 500</span>
                </div>
              )}
              
              <button
                type="submit"
                disabled={(!content.trim() && !mediaFile) || loading}
                className="rounded-full bg-zinc-900 px-6 py-2.5 text-[15px] font-bold text-white shadow-sm transition-all hover:bg-zinc-800 active:scale-95 disabled:opacity-40 disabled:active:scale-100"
              >
                {loading ? 'Загрузка...' : 'Пост'}
              </button>
            </div>

          </div>
        </form>
      </div>

      <AnimatePresence>
        {showFullscreenPreview && previewUrl && mediaFile && (
          <div 
            className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center p-2 sm:p-6" 
            onClick={() => setShowFullscreenPreview(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full h-full flex items-center justify-center"
            >
              <button 
                className="absolute top-4 right-4 sm:top-8 sm:right-8 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-colors z-20"
                onClick={() => setShowFullscreenPreview(false)}
              >
                <X className="w-6 h-6" />
              </button>
              
              {mediaFile.type.startsWith('video/') ? (
                <video src={previewUrl} controls autoPlay preload="metadata" className="max-w-full max-h-full rounded-lg object-contain shadow-2xl relative z-10" onClick={(e) => e.stopPropagation()} />
              ) : (
                <img src={previewUrl} alt="Full media preview" className="max-w-full max-h-full rounded-lg object-contain shadow-2xl relative z-10" onClick={(e) => e.stopPropagation()} />
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
