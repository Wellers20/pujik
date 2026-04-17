import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Post } from './Post';
import { generateAvatarStyle, getAvatarText, cn } from '../lib/utils';
import { Calendar, Hash, Settings, Camera, X, Users, MessageSquare, Bookmark, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { AdminBadge } from './AdminBadge';
import imageCompression from 'browser-image-compression';


export function Profile({ session }: { session: any }) {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Stats states
  const [totalLikes, setTotalLikes] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  // Edit Profile States
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'posts' | 'bookmarks'>('posts');
  const [bookmarkedPosts, setBookmarkedPosts] = useState<any[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchProfileData = async () => {
      setLoading(true);
      try {
        // Fetch admins globally
        try {
          const { data: adminsData } = await supabase.from('admins').select('user_id');
          if (adminsData) {
            setAdminIds(new Set(adminsData.map(a => a.user_id)));
          }
        } catch (e) {
          // Ignore
        }

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('username', username)
          .single();

        if (profileError || !profileData) {
          setProfile(null);
          return;
        }

        setProfile(profileData);
        setEditUsername(profileData.username);
        setEditBio(profileData.bio || '');

        // Fetch Posts
        const { data: postsData, error: postsError } = await supabase
          .from('posts')
          .select(`*, profiles!inner(username, avatar_url, banner_url), likes(count), comments(count)`)
          .eq('user_id', profileData.id)
          .order('created_at', { ascending: false });

        if (!postsError && postsData) {
          setPosts(postsData);
          const postIds = postsData.map(p => p.id);
          if (postIds.length > 0) {
            const { count } = await supabase
              .from('likes')
              .select('*', { count: 'exact', head: true })
              .in('post_id', postIds);
            setTotalLikes(count || 0);
          }
        }

        // Fetch Followers/Following stats
        const { count: fersCount } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', profileData.id);
          
        const { count: fingCount } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', profileData.id);
          
        setFollowersCount(fersCount || 0);
        setFollowingCount(fingCount || 0);

        // Check if current user is following this profile
        if (session?.user && session.user.id !== profileData.id) {
          const { data: followData } = await supabase
            .from('follows')
            .select('follower_id')
            .eq('follower_id', session.user.id)
            .eq('following_id', profileData.id)
            .single();
          setIsFollowing(!!followData);
        }

      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    };

    if (username) fetchProfileData();
  }, [username, session]);

  useEffect(() => {
    const fetchBookmarks = async () => {
      if (activeTab === 'bookmarks' && session?.user && session.user.id === profile?.id) {
        setLoading(true);
        try {
          const { data } = await supabase
            .from('bookmarks')
            .select(`
              post_id,
              posts (*, profiles(username, avatar_url), likes(count), comments(count))
            `)
            .eq('user_id', profile.id)
            .order('created_at', { ascending: false });

          if (data) {
            setBookmarkedPosts(data.map(b => b.posts).filter(p => p !== null));
          }
        } catch (e) {
          console.error("No bookmarks table or error");
        } finally {
          setLoading(false);
        }
      }
    };
    fetchBookmarks();
  }, [activeTab, profile, session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handlePostDeleted = (id: string) => {
    setPosts(prev => prev.filter(p => p.id !== id));
  };

  const handleFollowToggle = async () => {
    if (!session?.user || !profile) return;
    
    // Optimistic UI updates
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    setFollowersCount(prev => wasFollowing ? prev - 1 : prev + 1);
    
    try {
      if (wasFollowing) {
        await supabase.from('follows').delete().eq('follower_id', session.user.id).eq('following_id', profile.id);
      } else {
        await supabase.from('follows').insert({ follower_id: session.user.id, following_id: profile.id });
        
        // Создаем уведомление
        await supabase.from('notifications').insert({
          recipient_id: profile.id,
          actor_id: session.user.id,
          type: 'follow'
        });
      }
    } catch (error) {
      // Revert on error
      console.error('Ошибка подписки:', error);
      setIsFollowing(wasFollowing);
      setFollowersCount(prev => wasFollowing ? prev + 1 : prev - 1);
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setProfileError(null);
    try {
      let newAvatarUrl = profile.avatar_url;
      let newBannerUrl = profile.banner_url;

      if (avatarFile) {
        let fileToUpload: File | Blob = avatarFile;
        try {
          const options = { maxSizeMB: 0.3, maxWidthOrHeight: 400, useWebWorker: true };
          fileToUpload = await imageCompression(avatarFile, options);
        } catch (e) {
          console.error(e);
        }
        const fileExt = avatarFile.name.split('.').pop() || 'png';
        const fileName = `avatar_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, fileToUpload);
        
        if (uploadError) throw new Error('Ошибка загрузки аватара');
        const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
        newAvatarUrl = data.publicUrl;
      }
      
      if (bannerFile) {
        let fileToUpload: File | Blob = bannerFile;
        try {
          const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1200, useWebWorker: true };
          fileToUpload = await imageCompression(bannerFile, options);
        } catch (e) {
          console.error(e);
        }
        const fileExt = bannerFile.name.split('.').pop() || 'png';
        const fileName = `banner_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, fileToUpload);
        
        if (uploadError) throw new Error('Ошибка загрузки шапки профиля');
        const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
        newBannerUrl = data.publicUrl;
      }

      const cleanUsername = editUsername.toLowerCase().trim();
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ username: cleanUsername, bio: editBio, avatar_url: newAvatarUrl, banner_url: newBannerUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      // Update local state temporarily so user doesn't have to wait for sync
      setProfile({ ...profile, username: cleanUsername, bio: editBio, avatar_url: newAvatarUrl, banner_url: newBannerUrl });
      setIsEditProfileOpen(false);
      
      if (cleanUsername !== username) {
        navigate(`/profile/${cleanUsername}`, { replace: true });
      }
    } catch (err: any) {
      setProfileError(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-xl text-center py-20 mt-12 bg-white rounded-3xl border border-zinc-100 shadow-sm">
        <div className="text-4xl mb-4">😶</div>
        <h2 className="text-xl font-bold text-zinc-900">Профиль не найден</h2>
        <p className="text-zinc-500 mt-2">Возможно, пользователь удалил аккаунт или сменил имя.</p>
      </div>
    );
  }

  const isOwnProfile = session?.user?.id === profile.id;

  return (
    <div className="mx-auto max-w-xl px-4 py-8 relative">
      
      {/* Шапка профиля */}
      <div className="bg-white rounded-3xl pb-6 sm:pb-8 shadow-[0_2px_12px_rgb(0,0,0,0.03)] border border-zinc-100 overflow-hidden mb-8 relative">
        <div className="h-32 bg-zinc-100 w-full relative overflow-hidden">
          {profile.banner_url ? (
            <img src={profile.banner_url} alt="Banner" className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
          )}
        </div>
        
        <div className="px-6 md:px-8 relative">
          <div className="absolute -top-12 md:-top-16 left-6 md:left-8">
            <div 
              className="h-24 w-24 md:h-32 md:w-32 rounded-full border-4 border-white flex-shrink-0 flex items-center justify-center text-white font-bold text-3xl shadow-sm bg-zinc-50 overflow-hidden"
              style={!profile.avatar_url ? generateAvatarStyle(profile.username) : undefined}
            >
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.username} className="h-full w-full object-cover" />
              ) : (
                getAvatarText(profile.username)
              )}
            </div>
          </div>
          
          <div className="flex justify-end pt-4 pb-2 md:pt-4 h-16 gap-2">
            {!isOwnProfile && session?.user && (
              <>
                <button 
                  onClick={handleFollowToggle}
                  className={cn(
                    "h-9 px-5 rounded-full font-bold text-[14px] transition-colors",
                    isFollowing 
                      ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 border border-zinc-200" 
                      : "bg-zinc-900 text-white hover:bg-zinc-800"
                  )}
                >
                  {isFollowing ? 'Вы подписаны' : 'Подписаться'}
                </button>
                <button 
                  onClick={() => navigate(`/chat/${profile.username}`)}
                  className="h-9 w-9 flex items-center justify-center rounded-full bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              </>
            )}
            {isOwnProfile && (
              <>
                <button onClick={() => setIsEditProfileOpen(true)} className="h-9 px-4 rounded-full font-bold text-[14px] bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50 transition-colors hidden sm:block">
                  Редактировать
                </button>
                <button 
                  onClick={() => setIsSettingsOpen(true)}
                  className="h-9 w-9 flex items-center justify-center rounded-full bg-zinc-50 text-zinc-900 border border-zinc-200 hover:bg-zinc-100 transition-colors"
                >
                  <Settings className="w-[18px] h-[18px]" />
                </button>
              </>
            )}
          </div>
          
          <div className="mt-2 md:mt-4">
            <h1 className="text-2xl md:text-3xl font-extrabold text-zinc-900 tracking-tight leading-none mb-1 flex items-center gap-2">
              {profile.username}
              {adminIds.has(profile.id) && <AdminBadge />}
            </h1>
            <p className="text-zinc-500 font-medium text-[15px] mb-4">@{profile.username}</p>
            
            <p className="text-[15px] text-zinc-900 leading-relaxed max-w-sm mb-4">
              {profile.bio || "Привет! Я использую эту сеть."}
            </p>

            <div className="flex flex-wrap gap-5 text-[15px] mb-5">
              <div className="cursor-pointer">
                <span className="font-bold text-zinc-900">{followersCount}</span>{' '}
                <span className="text-zinc-500">Подписчиков</span>
              </div>
              <div className="cursor-pointer">
                <span className="font-bold text-zinc-900">{followingCount}</span>{' '}
                <span className="text-zinc-500">Подписок</span>
              </div>
              <div className="cursor-pointer hidden sm:block">
                <span className="font-bold text-zinc-900">{posts.length}</span>{' '}
                <span className="text-zinc-500">Постов</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-zinc-500 text-[14px] font-medium">
              <Calendar className="h-4 w-4 opacity-70" />
              <span>Регистрация: {format(new Date(profile.created_at), 'MMMM yyyy', { locale: ru })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 mb-6 sticky top-14 bg-[#fafafa]/80 backdrop-blur-md z-10 pt-2">
        <button 
          onClick={() => setActiveTab('posts')}
          className={cn("pb-3 px-6 text-[15px] font-bold transition-colors", activeTab === 'posts' ? "text-zinc-900 border-b-[3px] border-zinc-900" : "text-zinc-400 hover:text-zinc-700")}
        >
          Записи
        </button>
        {isOwnProfile && (
          <button 
            onClick={() => setActiveTab('bookmarks')}
            className={cn("pb-3 px-6 text-[15px] font-bold transition-colors", activeTab === 'bookmarks' ? "text-zinc-900 border-b-[3px] border-zinc-900" : "text-zinc-400 hover:text-zinc-700")}
          >
            Закладки
          </button>
        )}
      </div>

      <div className="space-y-0 relative">
        {activeTab === 'posts' ? (
          posts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-zinc-100 shadow-sm mt-4">
              <div className="mx-auto w-12 h-12 bg-zinc-50 rounded-full flex items-center justify-center mb-4">
                <Hash className="w-5 h-5 text-zinc-400" />
              </div>
              <p className="text-zinc-500 text-[15px] px-8">У пользователя нет ни одной публикации.</p>
            </div>
          ) : (
            posts.map((post) => (
              <Post 
                key={post.id} 
                post={post} 
                currentUser={session?.user} 
                onPostDeleted={handlePostDeleted} 
                adminIds={adminIds}
                currentUserIsAdmin={session?.user && adminIds.has(session.user.id)}
              />
            ))
          )
        ) : (
          bookmarkedPosts.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-zinc-100 shadow-sm mt-4">
              <div className="mx-auto w-12 h-12 bg-zinc-50 rounded-full flex items-center justify-center mb-4">
                <Bookmark className="w-5 h-5 text-zinc-400" />
              </div>
              <p className="text-zinc-500 text-[15px] px-8">У вас пока нет сохраненных записей.</p>
            </div>
          ) : (
            bookmarkedPosts.map((post) => (
              <Post 
                key={post.id} 
                post={post} 
                currentUser={session?.user} 
                onPostDeleted={(id) => setBookmarkedPosts(prev => prev.filter(p => p.id !== id))} 
                adminIds={adminIds}
                currentUserIsAdmin={session?.user && adminIds.has(session.user.id)}
              />
            ))
          )
        )}
      </div>

      {/* Модальное окно Редактирования Профиля */}
      <AnimatePresence>
        {isEditProfileOpen && (
          <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 10 }} 
              className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl border border-zinc-100 relative max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 pb-2 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-20">
                <h3 className="font-extrabold text-xl tracking-tight">Редактировать профиль</h3>
                <button 
                  onClick={() => setIsEditProfileOpen(false)}
                  className="p-2 bg-zinc-100 hover:bg-zinc-200 rounded-full transition-colors text-zinc-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="p-6">
                {profileError && (
                  <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
                    {profileError}
                  </div>
                )}

                {/* Upload Banner and Avatar integrated */}
                <div className="relative mb-12 mt-2">
                  <input type="file" accept="image/*" className="hidden" ref={bannerInputRef} onChange={e => { if(e.target.files?.[0]) setBannerFile(e.target.files[0]) }} />
                  <div onClick={() => bannerInputRef.current?.click()} className="h-28 w-full bg-zinc-100 rounded-2xl overflow-hidden relative group cursor-pointer border border-zinc-200/50">
                    {bannerFile ? (
                      <img src={URL.createObjectURL(bannerFile)} className="w-full h-full object-cover" />
                    ) : profile.banner_url ? (
                      <img src={profile.banner_url} className="w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
                    )}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  
                  <div className="absolute -bottom-8 left-6">
                    <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        ref={fileInputRef}
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) setAvatarFile(e.target.files[0]);
                        }}
                    />
                    <div 
                      className="relative h-20 w-20 rounded-full border-4 border-white overflow-hidden group cursor-pointer bg-zinc-50 shadow-sm text-2xl font-bold flex items-center justify-center text-white"
                      onClick={() => fileInputRef.current?.click()}
                      style={!profile.avatar_url && !avatarFile ? generateAvatarStyle(profile.username) : undefined}
                    >
                      {avatarFile ? (
                        <img src={URL.createObjectURL(avatarFile)} className="w-full h-full object-cover" />
                      ) : profile.avatar_url ? (
                        <img src={profile.avatar_url} className="w-full h-full object-cover" />
                      ) : (
                        getAvatarText(profile.username)
                      )}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide ml-1">Имя пользователя (Никнейм)</label>
                    <input
                      type="text"
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      className="w-full mt-1.5 px-4 py-3 bg-zinc-50/50 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-all font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wide ml-1">О себе</label>
                    <textarea
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      maxLength={160}
                      rows={3}
                      className="w-full mt-1.5 px-4 py-3 bg-zinc-50/50 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-all resize-none"
                      placeholder="Расскажите о себе..."
                    />
                    <div className="text-right text-xs text-zinc-400 mt-1 mr-1">{editBio.length}/160</div>
                  </div>

                  <div className="pt-2">
                    <button 
                      onClick={handleSaveProfile} 
                      disabled={savingProfile || !editUsername.trim()}
                      className="w-full flex justify-center items-center py-3.5 bg-zinc-900 text-white font-bold text-[15px] rounded-2xl hover:bg-zinc-800 active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      {savingProfile ? 'Сохранение...' : 'Сохранить изменения'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Модальное окно Настроек */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl border border-zinc-100 relative"
            >
              <h3 className="font-extrabold text-xl mb-6 tracking-tight text-center">Настройки</h3>
              
              <div className="space-y-3">
                <button 
                  onClick={() => { setIsSettingsOpen(false); setIsEditProfileOpen(true); }}
                  className="w-full flex justify-center items-center py-3.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 border border-zinc-200 dark:border-zinc-700 font-bold text-[15px] rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-700 active:scale-[0.98] transition-all sm:hidden"
                >
                  Редактировать профиль
                </button>

                {session?.user && adminIds.has(session.user.id) && (
                  <button 
                    onClick={() => navigate('/admin')}
                    className="w-full flex justify-center items-center py-3.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 font-bold text-[15px] rounded-2xl hover:bg-amber-100 dark:hover:bg-amber-900/40 active:scale-[0.98] transition-all"
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Панель управления
                  </button>
                )}
                
                <button 
                  onClick={() => {
                    const isDark = document.documentElement.classList.contains('dark');
                    if (isDark) {
                      document.documentElement.classList.remove('dark');
                      localStorage.setItem('darkMode', 'false');
                    } else {
                      document.documentElement.classList.add('dark');
                      localStorage.setItem('darkMode', 'true');
                    }
                  }}
                  className="w-full flex justify-center items-center py-3.5 bg-zinc-50 text-zinc-900 border border-zinc-200 font-bold text-[15px] rounded-2xl hover:bg-zinc-100 active:scale-[0.98] transition-all"
                >
                  Переключить тему
                </button>

                <button 
                  onClick={handleLogout} 
                  className="w-full flex justify-center items-center py-3.5 bg-red-50 text-red-600 font-bold text-[15px] rounded-2xl hover:bg-red-100 active:scale-[0.98] transition-all"
                >
                  Выйти из аккаунта
                </button>

                <button 
                  onClick={() => setIsSettingsOpen(false)} 
                  className="w-full py-3.5 bg-white text-zinc-500 font-bold text-[15px] rounded-2xl hover:bg-zinc-50 active:scale-[0.98] transition-all"
                >
                  Отмена
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
