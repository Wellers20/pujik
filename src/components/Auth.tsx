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
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4 py-12 transition-colors">
      <div className="w-full max-w-[400px]">
        {/* Логотип */}
        <div className="flex justify-center mb-8">
          <div className="bg-zinc-900 dark:bg-zinc-100 p-3 rounded-2xl shadow-xl shadow-zinc-900/10 dark:shadow-none transition-colors">
            <Hash className="h-8 w-8 text-white dark:text-zinc-900 transition-colors" />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none border border-zinc-100 dark:border-zinc-800 transition-colors">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 text-center mb-2 transition-colors">
            {isSignUp ? 'Создать аккаунт' : 'Добро пожаловать'}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center mb-8 transition-colors">
            {isSignUp ? 'Присоединяйтесь к новому сообществу' : 'Рады видеть вас снова'}
          </p>

          <form className="space-y-4" onSubmit={handleAuth}>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 p-3.5 rounded-xl text-sm font-medium border border-red-100 dark:border-red-900/20 text-center transition-colors">
                {error}
              </div>
            )}

            {isSignUp && (
              <div className="space-y-1.5 px-1">
                <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide transition-colors">Никнейм</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-500 focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-500 transition-all sm:text-sm dark:text-zinc-50 dark:placeholder:text-zinc-600"
                  placeholder="name"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-1.5 px-1">
              <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide transition-colors">Email</label>
              <input
                type="email"
                required
                className="w-full px-4 py-3 bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-500 focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-500 transition-all sm:text-sm dark:text-zinc-50 dark:placeholder:text-zinc-600"
                placeholder="hello@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5 px-1">
              <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide transition-colors">Пароль</label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-500 focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-500 transition-all sm:text-sm dark:text-zinc-50 dark:placeholder:text-zinc-600"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center items-center rounded-xl bg-zinc-900 dark:bg-zinc-100 px-4 py-3.5 mt-6 text-sm font-semibold text-white dark:text-zinc-900 shadow-sm transition-all hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
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
                className="text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
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
