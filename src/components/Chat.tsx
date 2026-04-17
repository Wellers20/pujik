import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Send, ArrowLeft } from 'lucide-react';
import { generateAvatarStyle, getAvatarText } from '../lib/utils';
import { formatDistanceToNowStrict } from 'date-fns';
import { ru } from 'date-fns/locale';

export function Chat({ session }: { session: any }) {
  const { username } = useParams();
  const navigate = useNavigate();
  const [partner, setPartner] = useState<any>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initChat = async () => {
      if (!username || !session?.user) return;
      
      const { data: partnerData } = await supabase.from('profiles').select('*').eq('username', username).single();
      if (!partnerData) return navigate('/messages');
      setPartner(partnerData);

      const user1 = session.user.id;
      const user2 = partnerData.id;
      
      const { data: existingChat, error: chatError } = await supabase
        .from('chats')
        .select('id')
        .or(`and(user1_id.eq.${user1},user2_id.eq.${user2}),and(user1_id.eq.${user2},user2_id.eq.${user1})`)
        .maybeSingle();

      if (chatError) console.error('Error fetching chat:', chatError);

      if (existingChat) {
        setChatId(existingChat.id);
        fetchMessages(existingChat.id);
        await supabase.from('messages').update({ is_read: true }).eq('chat_id', existingChat.id).neq('sender_id', user1);
      }
      setLoading(false);
    };
    initChat();
  }, [username, session]);

  const fetchMessages = async (cId: string) => {
    try {
      const { data, error } = await supabase.from('messages').select('*').eq('chat_id', cId).order('created_at', { ascending: true });
      if (error) throw error;
      setMessages(data || []);
      scrollToBottom();
    } catch (e) {
      console.error('Error fetching messages:', e);
    }
  };

  useEffect(() => {
    if (!chatId) return;
    const channel = supabase
      .channel(`chat_${chatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, payload => {
        setMessages(prev => {
          if (prev.find(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
        scrollToBottom();
        
        if (payload.new.sender_id !== session.user.id) {
          supabase.from('messages').update({ is_read: true }).eq('id', payload.new.id);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [chatId, session]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !partner || !session?.user) return;
    
    const messageText = newMessage.trim();
    setNewMessage(''); // Clear early for UX

    // Optimistic message
    const tempId = Math.random().toString(36).substring(7);
    const optimisticMsg = {
      id: tempId,
      chat_id: chatId,
      sender_id: session.user.id,
      content: messageText,
      created_at: new Date().toISOString(),
      is_optimistic: true
    };
    
    setMessages(prev => [...prev, optimisticMsg]);
    scrollToBottom();
    
    try {
      let targetChatId = chatId;
      
      if (!targetChatId) {
        const { data: newChat, error: newChatError } = await supabase
          .from('chats')
          .insert({ user1_id: session.user.id, user2_id: partner.id })
          .select('id')
          .single();
          
        if (newChatError) throw newChatError;
        
        if (newChat) {
          targetChatId = newChat.id;
          setChatId(newChat.id);
        }
      }
      
      if (targetChatId) {
        const { data: sentMsg, error: msgError } = await supabase.from('messages').insert({
          chat_id: targetChatId,
          sender_id: session.user.id,
          content: messageText
        }).select().single();
        
        if (msgError) throw msgError;

        // Replace optimistic message with real message
        if (sentMsg) {
          setMessages(prev => prev.map(m => m.id === tempId ? sentMsg : m));
        }
        
        await supabase.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', targetChatId);

        // Send notification to partner
        await supabase.from('notifications').insert({
          recipient_id: partner.id,
          actor_id: session.user.id,
          type: 'message'
        });
      }
    } catch (err: any) {
      console.error('SendMessage error:', err);
      alert('Ошибка при отправке: ' + err.message);
      setNewMessage(messageText); // Restore on error
      setMessages(prev => prev.filter(m => m.id !== tempId)); // Remove optimistic
    }
  };

  if (loading) return <div className="flex justify-center p-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 dark:border-zinc-700 border-t-zinc-900 dark:border-t-zinc-100"></div></div>;
  if (!partner) return null;

  return (
    <div className="fixed inset-0 sm:relative sm:flex sm:flex-col sm:h-[calc(100vh-6rem)] sm:mt-4 max-w-xl mx-auto bg-white dark:bg-zinc-950 sm:rounded-[32px] sm:border border-zinc-200 dark:border-zinc-800 overflow-hidden z-[100] sm:z-50 shadow-lg transition-colors flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md sticky top-0 z-10 transition-colors flex-shrink-0">
        <button 
          onClick={() => {
            if (window.history.state && window.history.state.idx > 0) {
              navigate(-1);
            } else {
              navigate('/messages');
            }
          }} 
          className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400 transition-colors"
        >
          <ArrowLeft className="w-5 h-5"/>
        </button>
        <Link to={`/profile/${partner.username}`}  className="h-10 w-10 border border-zinc-200/50 dark:border-zinc-700 shadow-sm rounded-full overflow-hidden bg-zinc-50 dark:bg-zinc-900 flex-shrink-0 flex items-center justify-center font-bold text-white transition-colors" style={!partner.avatar_url ? generateAvatarStyle(partner.username) : undefined}>
          {partner.avatar_url ? <img src={partner.avatar_url} className="w-full h-full object-cover" /> : <span className="text-sm">{getAvatarText(partner.username)}</span>}
        </Link>
        <Link to={`/profile/${partner.username}`} className="font-bold text-[16px] hover:underline text-zinc-900 dark:text-zinc-50 transition-colors">{partner.username}</Link>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#fafafa] dark:bg-zinc-950 transition-colors">
        {messages.length === 0 ? (
          <div className="text-center text-zinc-400 dark:text-zinc-500 text-sm py-10 font-medium transition-colors">Напишите первое сообщение!</div>
        ) : (
          messages.map((m, i) => {
            const isMe = m.sender_id === session.user.id;
            return (
              <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`px-[18px] py-[10px] max-w-[75%] rounded-[20px] text-[15px] leading-snug transition-colors ${isMe ? 'bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-br-sm shadow-sm' : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-50 rounded-bl-sm shadow-sm'}`}>
                  {m.content}
                </div>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 mx-1.5 font-medium transition-colors">{new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              </div>
            )
          })
        )}
        <div ref={scrollRef} className="h-2" />
      </div>

      <form onSubmit={sendMessage} className="p-3 bg-white dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 flex gap-2 items-end pb-safe transition-colors">
        <textarea 
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          placeholder="Сообщение..."
          className="flex-1 max-h-32 min-h-[44px] bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-[22px] px-4 py-3 resize-none text-[15px] dark:text-zinc-50 dark:placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 focus:bg-white dark:focus:bg-zinc-900 transition-colors"
          rows={1}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage(e);
            }
          }}
        />
        <button type="submit" disabled={!newMessage.trim()} className="h-[46px] w-[46px] bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 rounded-full flex justify-center items-center flex-shrink-0 disabled:opacity-40 transition-all hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm active:scale-95">
          <Send className="w-[18px] h-[18px] ml-0.5" />
        </button>
      </form>
    </div>
  );
}
