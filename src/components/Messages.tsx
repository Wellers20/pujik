import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { generateAvatarStyle, getAvatarText } from '../lib/utils';
import { MessageSquare } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { ru } from 'date-fns/locale';

export function Messages({ session }: { session: any }) {
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChats = async (showLoading = true) => {
      if (showLoading) setLoading(true);
      try {
        const { data, error } = await supabase
          .from('chats')
          .select('id, updated_at, user1_id, user2_id')
          .or(`user1_id.eq.${session.user.id},user2_id.eq.${session.user.id}`)
          .order('updated_at', { ascending: false });
          
        if (error) {
          console.error("Messages fetch error:", error);
          return;
        }
        
        const enhancedData = await Promise.all((data || []).map(async (chat) => {
          const partnerId = chat.user1_id === session.user.id ? chat.user2_id : chat.user1_id;
          
          const [{ data: partnerData }, { data: msgData }] = await Promise.all([
            supabase.from('profiles').select('id, username, avatar_url').eq('id', partnerId).single(),
            supabase.from('messages').select('content, created_at, sender_id, is_read').eq('chat_id', chat.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
          ]);
            
          return { ...chat, partner: partnerData, lastMessage: msgData };
        }));

        setChats(enhancedData);
      } catch (e) {
        console.error("Messages enhanced fetch error:", e);
      } finally {
        if (showLoading) setLoading(false);
      }
    };

    if (session?.user) {
      fetchChats();

      const channel = supabase
        .channel('public:chats')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'chats' 
        }, () => fetchChats(false))
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'messages'
        }, () => fetchChats(false))
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [session]);

  if (loading) return (
    <div className="flex justify-center p-12">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900"></div>
    </div>
  );

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-black mb-8 dark:text-zinc-50 transition-colors">Сообщения</h1>
      
      {chats.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-[32px] border border-zinc-100 dark:border-zinc-800 shadow-[0_2px_8px_rgb(0,0,0,0.02)] mt-4 transition-colors">
          <div className="mx-auto w-16 h-16 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4 border border-zinc-100 dark:border-zinc-700">
            <MessageSquare className="w-6 h-6 text-zinc-300 dark:text-zinc-500" />
          </div>
          <h3 className="font-bold text-lg mb-1 dark:text-zinc-50">У вас пока нет диалогов</h3>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm px-6">Зайдите в профиль друга, чтобы написать сообщение!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {chats.map(chat => {
            const partner = chat.partner;
            if (!partner) return null;
            return (
              <Link key={chat.id} to={`/chat/${partner.username}`} className="flex items-center gap-4 p-4 bg-white dark:bg-zinc-900 rounded-[28px] shadow-sm border border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700 hover:shadow-md transition-all active:scale-[0.99]">
                  <div className="h-14 w-14 flex-shrink-0 border border-zinc-200/50 dark:border-zinc-700 shadow-sm rounded-full overflow-hidden flex items-center justify-center font-bold text-lg bg-zinc-50 dark:bg-zinc-800 text-white" style={!partner.avatar_url ? generateAvatarStyle(partner.username) : undefined}>
                    {partner.avatar_url ? <img src={partner.avatar_url} className="w-full h-full object-cover" /> : getAvatarText(partner.username)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-0.5">
                      <span className="font-bold text-[16px] text-zinc-900 dark:text-zinc-50 truncate transition-colors">{partner.username}</span>
                      {chat.lastMessage && (
                        <span className="text-[12px] text-zinc-400 dark:text-zinc-500 font-medium flex-shrink-0 ml-2 mt-0.5 transition-colors">
                          {formatDistanceToNowStrict(new Date(chat.lastMessage.created_at), { locale: ru })}
                        </span>
                      )}
                    </div>
                    <p className={`text-[14px] leading-snug truncate transition-colors ${chat.lastMessage?.is_read === false && chat.lastMessage?.sender_id !== session.user.id ? 'font-bold text-zinc-900 dark:text-zinc-50' : 'text-zinc-500 dark:text-zinc-400'}`}>
                      {chat.lastMessage ? (
                        <>
                          {chat.lastMessage.sender_id === session.user.id && <span className="opacity-70 mr-1">Вы:</span>}
                          {chat.lastMessage.content}
                        </>
                      ) : 'Диалог начат'}
                    </p>
                  </div>
                  {chat.lastMessage?.is_read === false && chat.lastMessage?.sender_id !== session.user.id && (
                     <div className="w-2.5 h-2.5 rounded-full bg-blue-500 dark:bg-blue-400 mr-1" />
                  )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  );
}
