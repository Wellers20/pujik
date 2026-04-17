import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { Heart, MessageCircle, Share, MoreHorizontal, Trash2, Send, Check, Play, X } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { cn, generateAvatarStyle, getAvatarText } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { CommentItem } from './CommentItem';
import { AdminBadge } from './AdminBadge';

export function Post({ post, currentUser, onPostDeleted, isDetailView = false, adminIds = new Set(), currentUserIsAdmin = false }: { post: any, currentUser: any, onPostDeleted?: (id: string) => void, isDetailView?: boolean, adminIds?: Set<string>, currentUserIsAdmin?: boolean }) {
  const [likesCount, setLikesCount] = useState(post.likes?.[0]?.count || 0);
  const [commentsCount, setCommentsCount] = useState(post.comments?.[0]?.count || 0);
  const [isLiked, setIsLiked] = useState(post.is_liked_by_user || false);
  const [loading, setLoading] = useState(!('is_liked_by_user' in post));
  
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Media states
  const [showFullscreenMedia, setShowFullscreenMedia] = useState(false);

  // States for comments
  const [showComments, setShowComments] = useState(isDetailView); // Always show if detail view
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Admin and permission flags
  const isOwnPost = currentUser?.id === post.user_id;
  const canDelete = isOwnPost || currentUserIsAdmin;
  const postIsAdmin = adminIds.has(post.user_id);
  
  const username = post.profiles?.username || 'пользователь';

  useEffect(() => {
    const checkLikedStatus = async () => {
      if (!currentUser || 'is_liked_by_user' in post) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('likes')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', currentUser.id)
        .single();
      
      if (data && !error) setIsLiked(true);
      setLoading(false);
    };
    checkLikedStatus();
    if (isDetailView) fetchComments();
  }, [post.id, currentUser, post]);

  const handleLike = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUser || loading) return;
    if (post.user_id === currentUser.id) return;
    
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikesCount((prev: number) => wasLiked ? prev - 1 : prev + 1);

    try {
      if (wasLiked) {
        await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', currentUser.id);
      } else {
        await supabase.from('likes').insert({ post_id: post.id, user_id: currentUser.id });
      }
    } catch {
      setIsLiked(wasLiked);
      setLikesCount((prev: number) => wasLiked ? prev : prev - 1);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    setDeleteError(null);
    try {
      // 1. Ручное удаление зависимостей (на случай, если SQL CASCADE не настроен пользователем)
      // Сначала получаем ID всех комментариев к посту
      const { data: commentData } = await supabase
        .from('comments')
        .select('id')
        .eq('post_id', post.id);

      if (commentData && commentData.length > 0) {
        const commentIds = commentData.map(c => c.id);
        // Удаляем лайки к этим комментариям
        await supabase.from('comment_likes').delete().in('comment_id', commentIds);
        // Удаляем сами комментарии
        await supabase.from('comments').delete().in('id', commentIds);
      }

      // Удаляем лайки к посту
      await supabase.from('likes').delete().eq('post_id', post.id);
      
      // 2. Удаление медиа из Storage, если оно есть
      if (post.media_url) {
        try {
          const urlParts = post.media_url.split('/');
          const fileName = urlParts[urlParts.length - 1];
          if (fileName) {
            await supabase.storage.from('media').remove([fileName]);
          }
        } catch (storageErr) {
          console.error('Ошибка при удалении файла из хранилища:', storageErr);
        }
      }

      // 3. Финальное удаление самого поста
      const { error } = await supabase.from('posts').delete().eq('id', post.id);
      
      if (error) {
        throw error;
      } else {
        if (onPostDeleted) onPostDeleted(post.id);
      }
    } catch (err: any) {
      console.error('Ошибка удаления:', err);
      setDeleteError(err.message || 'Неизвестная ошибка при удалении');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    setLoadingComments(true);
    const { data } = await supabase
      .from('comments')
      .select('*, profiles(username, avatar_url), comment_likes(count)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });
    
    if (data) setComments(data);
    setLoadingComments(false);
  };

  const toggleComments = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!showComments) {
      setShowComments(true);
      await fetchComments();
    } else {
      if (!isDetailView) setShowComments(false);
    }
  };

  const handleCommentDeleted = (id: string) => {
    setComments(prev => prev.filter(c => c.id !== id));
    setCommentsCount((c: number) => c - 1);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/post/${post.id}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !currentUser) return;
    
    setSubmittingComment(true);
    const { data, error } = await supabase
      .from('comments')
      .insert({
        post_id: post.id,
        user_id: currentUser.id,
        content: newComment.trim()
      })
      .select('*, profiles(username, avatar_url), comment_likes(count)')
      .single();

    if (data && !error) {
      setComments([...comments, data]);
      setCommentsCount((c: number) => c + 1);
      setNewComment('');
    }
    setSubmittingComment(false);
  };

  return (
    <>
      <article className={cn(
        "bg-white rounded-[24px] sm:rounded-[32px] shadow-[0_2px_8px_rgb(0,0,0,0.02)] border border-zinc-100/80 mb-4 transition-all relative z-0",
        isDetailView && "mb-8 shadow-md"
      )}>
        <div className="p-4 sm:p-5">
          <div className="flex gap-3 relative">
            
            <Link to={`/profile/${username}`} className="flex-shrink-0 z-10 block hover:opacity-90" onClick={e => e.stopPropagation()}>
              <div 
                className="h-[44px] w-[44px] rounded-full flex items-center justify-center font-bold text-base shadow-sm border border-zinc-200/50 overflow-hidden bg-zinc-50"
                style={!post.profiles?.avatar_url ? generateAvatarStyle(username) : undefined}
              >
                {post.profiles?.avatar_url ? (
                  <img src={post.profiles.avatar_url} alt={username} className="h-full w-full object-cover" />
                ) : (
                  getAvatarText(username)
                )}
              </div>
            </Link>
            
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex justify-between items-start mb-0.5">
                <div className="flex items-center gap-1.5 truncate">
                  <Link to={`/profile/${username}`} className="font-bold text-[15px] hover:underline text-zinc-900 truncate" onClick={e => e.stopPropagation()}>
                    {username}
                  </Link>
                  {postIsAdmin && <AdminBadge />}
                  <span className="text-zinc-500 font-medium text-[15px]">·</span>
                  <span className="text-zinc-500 text-[15px] whitespace-nowrap hover:underline">
                    {post.created_at ? formatDistanceToNowStrict(new Date(post.created_at), { locale: ru }) : ''}
                  </span>
                </div>
                
                <div className="relative z-20">
                  <button 
                    className="text-zinc-400 hover:text-zinc-900 transition-colors p-1.5 rounded-full hover:bg-zinc-100" 
                    onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }}
                  >
                    <MoreHorizontal className="h-[20px] w-[20px]" />
                  </button>
                  
                  <AnimatePresence>
                    {showMenu && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95, y: -10 }} 
                          animate={{ opacity: 1, scale: 1, y: 0 }} 
                          exit={{ opacity: 0, scale: 0.95, y: -10 }} 
                          className="absolute right-0 mt-1 w-44 bg-white border border-zinc-100 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-2xl overflow-hidden z-20 py-1"
                        >
                          <Link to={`/post/${post.id}`} className="w-full text-left px-4 py-2.5 text-[15px] text-zinc-700 hover:bg-zinc-50 font-semibold flex items-center gap-2.5">
                             Открыть пост
                          </Link>
                          {canDelete ? (
                            <button 
                              onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); setShowMenu(false); }} 
                              className="w-full text-left px-4 py-2.5 text-[15px] text-red-600 hover:bg-red-50 font-semibold flex items-center gap-2.5"
                            >
                              <Trash2 className="w-[18px] h-[18px]" /> Удалить
                            </button>
                          ) : null}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              
              <p className={cn("text-zinc-900 text-[16px] sm:text-[17px] leading-snug whitespace-pre-wrap mt-0.5", isDetailView && "text-[18px] sm:text-[20px] leading-relaxed")}>
                {post.content}
              </p>

              {post.media_url && (
                <div 
                  className="mt-3 w-[100px] h-[100px] sm:w-[124px] sm:h-[124px] rounded-2xl overflow-hidden border border-zinc-200/60 bg-zinc-50 relative shadow-sm cursor-pointer group" 
                  onClick={e => { e.stopPropagation(); setShowFullscreenMedia(true); }}
                >
                  {post.media_type?.startsWith('video') ? (
                    <>
                      <video src={post.media_url} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center transition-colors group-hover:bg-black/30">
                        <div className="w-10 h-10 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center">
                          <Play className="w-4 h-4 text-white ml-0.5" fill="currentColor" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <img src={post.media_url} alt="media thumbnail" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  )}
                </div>
              )}
              
              {/* Actions */}
              <div className="flex items-center gap-6 mt-3 md:gap-8" onClick={e => e.stopPropagation()}>
                <button
                  onClick={handleLike}
                  disabled={loading || isOwnPost}
                  className={cn(
                    "group flex items-center gap-1.5 text-sm font-medium transition-colors",
                    isLiked ? "text-rose-600" : "text-zinc-500 hover:text-rose-600",
                    isOwnPost && "opacity-40 cursor-not-allowed hover:text-zinc-500"
                  )}
                >
                  <div className={cn("p-2 -ml-2 rounded-full transition-colors", isLiked ? "bg-rose-50" : "group-hover:bg-rose-50")}>
                    <Heart className={cn("h-5 w-5 transition-transform group-active:scale-90", isLiked && "fill-current")} />
                  </div>
                  <span className={cn("min-w-[12px] -ml-1 text-[15px]", isLiked ? "font-semibold" : "")}>{likesCount > 0 && likesCount}</span>
                </button>

                <button 
                  onClick={toggleComments}
                  className={cn(
                    "group flex items-center gap-1.5 text-sm font-medium transition-colors",
                    showComments ? "text-blue-600" : "text-zinc-500 hover:text-blue-600"
                  )}
                >
                  <div className={cn("p-2 -ml-2 rounded-full transition-colors", showComments ? "bg-blue-50" : "group-hover:bg-blue-50")}>
                    <MessageCircle className="h-5 w-5 transition-transform group-active:scale-90" />
                  </div>
                  <span className={cn("min-w-[12px] -ml-1 text-[15px]", showComments && "font-semibold")}>{commentsCount > 0 && commentsCount}</span>
                </button>

                <button 
                  onClick={handleShare}
                  className="group flex items-center text-sm font-medium text-zinc-500 hover:text-green-600 transition-colors ml-auto mr-1 relative"
                >
                  <AnimatePresence>
                    {copied && (
                      <motion.div 
                        initial={{ opacity: 0, y: -20 }} 
                        animate={{ opacity: 1, y: -30 }} 
                        exit={{ opacity: 0 }} 
                        className="absolute left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[10px] px-2 py-1 rounded-md font-bold"
                      >
                        Скопировано!
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="p-2 rounded-full group-hover:bg-green-50 transition-colors flex items-center gap-2">
                    {copied ? <Check className="h-5 w-5 text-green-600" /> : <Share className="h-5 w-5 transition-transform group-active:scale-90" />}
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Модальное окно подтверждения удаления */}
        {showDeleteConfirm && createPortal(
          <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={() => !loading && setShowDeleteConfirm(false)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl border border-zinc-100"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="font-extrabold text-xl mb-3 tracking-tight text-zinc-900">Удалить запись?</h3>
              <p className="text-zinc-500 text-[15px] mb-6 leading-relaxed">Это действие нельзя будет отменить. Запись исчезнет из ленты и вашего профиля.</p>
              
              {deleteError && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-semibold leading-tight">
                  {deleteError}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <button 
                  onClick={handleDelete}
                  disabled={loading}
                  className="w-full py-3.5 bg-red-600 text-white font-bold text-[15px] rounded-2xl hover:bg-red-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : 'Удалить навсегда'}
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={loading}
                  className="w-full py-3.5 bg-zinc-100 text-zinc-900 font-bold text-[15px] rounded-2xl hover:bg-zinc-200 active:scale-[0.98] transition-all"
                >
                  Отмена
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}

        {/* Блок комментариев */}
        <AnimatePresence>
          {showComments && (
            <motion.div 
              initial={isDetailView ? { opacity: 1 } : { height: 0, opacity: 0 }} 
              animate={{ height: 'auto', opacity: 1 }} 
              exit={{ height: 0, opacity: 0 }} 
              className="overflow-hidden bg-zinc-50/50 border-t border-zinc-100 rounded-b-[24px] sm:rounded-b-[32px]"
            >
              <div className="p-4 sm:p-5 pt-3">
                {loadingComments ? (
                  <div className="flex justify-center py-4">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600"></div>
                  </div>
                ) : (
                  <div className="space-y-5 mb-5 mt-1">
                    {comments.length === 0 && (
                      <div className="text-zinc-500 text-[14px] text-center py-2">
                         Оставьте первый комментарий!
                      </div>
                    )}
                    {comments.map(c => (
                      <CommentItem 
                        key={c.id} 
                        comment={c} 
                        currentUser={currentUser} 
                        onDeleted={handleCommentDeleted} 
                        adminIds={adminIds}
                        currentUserIsAdmin={currentUserIsAdmin}
                      />
                    ))}
                  </div>
                )}

                {/* Поле ввода комментария */}
                <form onSubmit={handleSubmitComment} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Написать ответ..."
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    maxLength={300}
                    className="flex-1 bg-white border border-zinc-200 rounded-full px-4 py-2 text-[14.5px] focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all shadow-sm"
                  />
                  <button 
                    type="submit" 
                    disabled={!newComment.trim() || submittingComment}
                    className="bg-zinc-900 text-white p-2 rounded-full h-[38px] w-[38px] flex items-center justify-center disabled:opacity-40 hover:bg-zinc-800 transition-colors shadow-sm"
                  >
                    <Send className="w-4 h-4 ml-0.5" />
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </article>

      {/* Модальное окно просмотра полноразмерного медиа */}
      {showFullscreenMedia && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex items-center justify-center p-2 sm:p-6" 
          onClick={(e) => { e.stopPropagation(); setShowFullscreenMedia(false); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full h-full flex items-center justify-center"
          >
            <button 
              className="absolute top-4 right-4 sm:top-8 sm:right-8 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-colors z-20"
              onClick={(e) => { e.stopPropagation(); setShowFullscreenMedia(false); }}
            >
              <X className="w-6 h-6" />
            </button>
            
            {post.media_type?.startsWith('video') ? (
              <video src={post.media_url} controls autoPlay preload="metadata" className="max-w-full max-h-full rounded-lg object-contain shadow-2xl relative z-10" onClick={(e) => e.stopPropagation()} />
            ) : (
              <img src={post.media_url} alt="Full media" className="max-w-full max-h-full rounded-lg object-contain shadow-2xl relative z-10" onClick={(e) => e.stopPropagation()} />
            )}
          </motion.div>
        </div>,
        document.body
      )}
    </>
  );
}
