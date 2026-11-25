import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function MunicipalLoginPage() {
  const { signIn, isConfigured } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      navigate('/municipal');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Official sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-emerald-500/30 bg-civic-surface p-6 shadow-xl">
        <div className="flex items-center gap-2 text-emerald-400">
          <ShieldCheck className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wider">
            Municipal Authority Portal
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-white">Authorized Official Sign In</h1>
        <p className="mt-1 text-xs text-slate-400">
          For Super Administrators, Municipal Administrators, Department Officers, and Field Officers.
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
          <div>
            <label htmlFor="staff-email" className="block text-xs font-medium text-slate-300">
              Official Email
            </label>
            <input
              id="staff-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              placeholder="officer@municipality.gov"
            />
          </div>
          <div>
            <label htmlFor="staff-password" className="block text-xs font-medium text-slate-300">
              Password
            </label>
            <input
              id="staff-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {error && <p className="rounded-lg bg-rose-500/10 p-2.5 text-xs text-rose-300">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !isConfigured}
            className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {submitting ? 'Verifying Credentials...' : 'Sign In to Municipal Portal'}
          </button>
        </form>
      </div>
    </div>
  );
}
