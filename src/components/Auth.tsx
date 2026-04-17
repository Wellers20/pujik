import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Hash } from 'lucide-react';

export function Auth({ onAuthSuccess }: { onAuthSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        if (!username.trim()) throw new Error('Пожалуйста, укажите имя пользователя');

        const { error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: username.toLowerCase().trim() }
          }
        });

        if (authError) throw authError;
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) throw authError;
      }
      onAuthSuccess();
    } catch (err: any) {
      if (err.message.includes('Invalid login credentials')) {
        setError('Неверный email или пароль');
      } else if (err.message.includes('already registered')) {
        setError('Почта уже используется');
      } else if (err.message.includes('Password should be at least')) {
        setError('Пароль должен быть не менее 6 символов');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-[400px]">
        {/* Логотип */}
        <div className="flex justify-center mb-8">
          <div className="bg-zinc-900 p-3 rounded-2xl shadow-xl shadow-zinc-900/10">
            <Hash className="h-8 w-8 text-white" />
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-zinc-100">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 text-center mb-2">
            {isSignUp ? 'Создать аккаунт' : 'Добро пожаловать'}
          </h2>
          <p className="text-sm text-zinc-500 text-center mb-8">
            {isSignUp ? 'Присоединяйтесь к новому сообществу' : 'Рады видеть вас снова'}
          </p>

          <form className="space-y-4" onSubmit={handleAuth}>
            {error && (
              <div className="bg-red-50 text-red-600 p-3.5 rounded-xl text-sm font-medium border border-red-100 text-center">
                {error}
              </div>
            )}

            {isSignUp && (
              <div className="space-y-1.5 px-1">
                <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Никнейм</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-zinc-50/50 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-all sm:text-sm"
                  placeholder="name"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-1.5 px-1">
              <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Email</label>
              <input
                type="email"
                required
                className="w-full px-4 py-3 bg-zinc-50/50 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-all sm:text-sm"
                placeholder="hello@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5 px-1">
              <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Пароль</label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 bg-zinc-50/50 border border-zinc-200 rounded-xl focus:bg-white focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-all sm:text-sm"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center items-center rounded-xl bg-zinc-900 px-4 py-3.5 mt-6 text-sm font-semibold text-white shadow-sm transition-all hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
            >
              {loading ? 'Секунду...' : isSignUp ? 'Зарегистрироваться' : 'Войти в сеть'}
            </button>
            
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError(null);
                }}
                className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
              >
                {isSignUp ? 'Есть аккаунт? Войти' : 'Создать новый аккаунт'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
