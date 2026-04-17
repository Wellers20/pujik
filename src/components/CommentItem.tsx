import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { formatDistanceToNowStrict } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn, generateAvatarStyle, getAvatarText } from '../lib/utils';
import { Trash2 } from 'lucide-react';
import { AdminBadge } from './AdminBadge';

export function CommentItem({ 
  comment, 
  currentUser, 
  onDeleted,
  adminIds = new Set(),
  currentUserIsAdmin = false
}: { 
  comment: any, 
  currentUser: any, 
  onDeleted: (id: string) => void,
  adminIds?: Set<string>,
  currentUserIsAdmin?: boolean
}) {
  const cUsername = comment.profiles?.username || 'пользователь';
  
  const [likesCount, setLikesCount] = useState(comment.comment_likes?.[0]?.count || 0);
  const [isLiked, setIsLiked] = useState(false);
  const [loading, setLoading] = useState(true);

  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isOwner = currentUser?.id === comment.user_id;
  const canDelete = isOwner || currentUserIsAdmin;
  const commentIsAdmin = adminIds.has(comment.user_id);

  useEffect(() => {
    if (!currentUser) return;
    supabase
      .from('comment_likes')
      .select('id')
      .eq('comment_id', comment.id)
      .eq('user_id', currentUser.id)
      .single()
      .then(({ data }) => {
        if (data) setIsLiked(true);
        setLoading(false);
      });
  }, [comment.id, currentUser]);

  const handleLikeComment = async () => {
    if (!currentUser || loading) return;
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikesCount((prev: number) => wasLiked ? prev - 1 : prev + 1);

    try {
      if (wasLiked) {
        await supabase.from('comment_likes').delete().eq('comment_id', comment.id).eq('user_id', currentUser.id);
      } else {
        await supabase.from('comment_likes').insert({ comment_id: comment.id, user_id: currentUser.id });
      }
    } catch {
      setIsLiked(wasLiked);
      setLikesCount((prev: number) => wasLiked ? prev : prev - 1);
    }
  };

  const handleDeleteComment = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      // 1. Сначала удаляем лайки к комментарию (чтобы избежать проблем с ключами)
      const { error: likesErr } = await supabase
        .from('comment_likes')
        .delete()
        .eq('comment_id', comment.id);
      
      if (likesErr) throw likesErr;

      // 2. Теперь удаляем сам комментарий
      const { error } = await supabase.from('comments').delete().eq('id', comment.id);
      
      if (error) {
        throw error;
      } else {
        onDeleted(comment.id);
        setShowDeleteConfirm(false);
      }
    } catch (err: any) {
      console.error('Ошибка при удалении комментария:', err);
      setDeleteError(err.message || 'Не удалось удалить комментарий');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="flex gap-2.5 group">
        <div 
          className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-xs shadow-sm border border-zinc-200/50 overflow-hidden mt-0.5"
          style={!comment.profiles?.avatar_url ? generateAvatarStyle(cUsername) : undefined}
        >
          {comment.profiles?.avatar_url ? (
            <img src={comment.profiles.avatar_url} alt={cUsername} className="h-full w-full object-cover" />
          ) : (
            getAvatarText(cUsername)
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="bg-white border border-zinc-100 rounded-[18px] rounded-tl-[4px] px-3.5 py-2 flex flex-col w-fit max-w-full shadow-sm relative">
            <div className="flex items-center gap-1.5 mb-0.5 pr-2">
              <span className="font-bold text-[13px] text-zinc-900">{cUsername}</span>
              {commentIsAdmin && <AdminBadge />}
            </div>
            <p className="text-[14px] text-zinc-800 leading-snug break-words">{comment.content}</p>
          </div>
          <div className="flex items-center gap-4 mt-1.5 ml-1">
            <span className="text-[12px] text-zinc-400 font-medium tracking-tight">
              {formatDistanceToNowStrict(new Date(comment.created_at), { locale: ru })}
            </span>
            <button 
              onClick={handleLikeComment} 
              className={cn(
                "text-[12px] font-bold transition-all flex items-center gap-1 active:scale-95", 
                isLiked ? "text-rose-600" : "text-zinc-500 hover:text-zinc-900"
              )}
            >
              {isLiked ? 'Любимо' : 'Нравится'} 
              {likesCount > 0 && <span className={cn("ml-0.5", isLiked ? "text-rose-600/80" : "text-zinc-400")}>· {likesCount}</span>}
            </button>
            
            {canDelete && (
              <button 
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeleting}
                className="text-zinc-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 active:scale-90"
                title="Удалить"
              >
                <Trash2 className="w-[14px] h-[14px]" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Модальное окно подтверждения удаления комментария */}
      {showDeleteConfirm && createPortal(
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div 
            className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl border border-zinc-100 animate-in fade-in zoom-in duration-200"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-extrabold text-xl mb-3 tracking-tight text-zinc-900 text-center">Удалить комментарий?</h3>
            <p className="text-zinc-500 text-[15px] mb-6 leading-relaxed text-center">Это действие нельзя будет отменить.</p>
            
            {deleteError && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-semibold leading-tight text-center">
                {deleteError}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button 
                onClick={handleDeleteComment}
                disabled={isDeleting}
                className="w-full py-3.5 bg-red-600 text-white font-bold text-[15px] rounded-2xl hover:bg-red-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : 'Удалить'}
              </button>
              <button 
                onClick={() => { setShowDeleteConfirm(false); setDeleteError(null); }}
                disabled={isDeleting}
                className="w-full py-3.5 bg-zinc-100 text-zinc-900 font-bold text-[15px] rounded-2xl hover:bg-zinc-200 active:scale-[0.98] transition-all"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
