import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function AuthPage() {
  const { signIn, signUp, isConfigured } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);

    try {
      if (mode === 'login') {
        await signIn(email, password);
        navigate('/citizen');
      } else {
        await signUp(email, password, fullName);
        setMessage('Account created! Please check your email to confirm your address before signing in.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-slate-800 bg-civic-surface p-6 shadow-xl">
        <div className="flex items-center gap-2 text-sky-400">
          <UserCheck className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wider">Citizen Portal</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-white">
          {mode === 'login' ? 'Sign in to CivicConnect' : 'Create a Citizen Account'}
        </h1>

        {!isConfigured && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <span>
              Supabase environment variables are not configured yet. Add <code className="font-mono">VITE_SUPABASE_URL</code> and{' '}
              <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> to <code className="font-mono">.env</code> to enable authentication.
            </span>
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
          {mode === 'register' && (
            <div>
              <label htmlFor="fullName" className="block text-xs font-medium text-slate-300">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-sky-500 focus:outline-none"
                placeholder="Aarav Sharma"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-xs font-medium text-slate-300">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-sky-500 focus:outline-none"
              placeholder="citizen@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-slate-300">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-sky-500 focus:outline-none"
              placeholder="Minimum 6 characters"
            />
          </div>

          {error && <p className="rounded-lg bg-rose-500/10 p-2.5 text-xs text-rose-300">{error}</p>}
          {message && <p className="rounded-lg bg-emerald-500/10 p-2.5 text-xs text-emerald-300">{message}</p>}

          <button
            type="submit"
            disabled={submitting || !isConfigured}
            className="w-full rounded-xl bg-sky-500 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
          >
            {submitting ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-5 text-center text-xs text-slate-400">
          {mode === 'login' ? (
            <>
              New to CivicConnect?{' '}
              <button type="button" onClick={() => setMode('register')} className="font-semibold text-sky-400 hover:underline">
                Register here
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button type="button" onClick={() => setMode('login')} className="font-semibold text-sky-400 hover:underline">
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
