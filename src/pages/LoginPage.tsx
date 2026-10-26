import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Mail } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AuthLayout } from '@/components/AuthLayout';
import { Button, Field, inputClass } from '@/components/ui/primitives';
import { AuthError, INVITED_ACCOUNTS, isRegistered } from '@/services/auth';

export function LoginPage() {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to="/" replace />;

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      navigate(redirectTo, { replace: true });
    } catch (caught) {
      setError(caught instanceof AuthError ? caught.message : 'Unable to sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Let's make room for the Word"
      subtitle="Sign in to open your private notebook, your weekly Scripture and today's encouragement."
      footer={
        <p className="font-sans text-[0.78rem] text-charcoal/55">
          First time here?{' '}
          <Link to="/register" className="font-medium text-forest underline underline-offset-4">
            Create your account
          </Link>
        </p>
      }
    >
      <form className="space-y-4" onSubmit={submit} noValidate>
        <Field label="Email address" htmlFor="login-email">
          <div className="relative">
            <Mail
              size={14}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal/30"
            />
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              className={`${inputClass} pl-9`}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
        </Field>

        <Field label="Password" htmlFor="login-password">
          <div className="relative">
            <Lock
              size={14}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal/30"
            />
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              className={`${inputClass} pl-9`}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
        </Field>

        {error ? (
          <p
            role="alert"
            className="rounded-[9px] border border-terracotta/40 bg-terracotta/[0.07] px-3.5 py-2.5 font-sans text-[0.76rem] leading-relaxed text-[#8a4f37]"
          >
            {error}
          </p>
        ) : null}

        <Button type="submit" full disabled={busy} iconRight={<ArrowRight size={14} />}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>

        <div className="rounded-journal border border-sage/35 bg-cream/40 p-3.5">
          <p className="font-sans text-[0.6rem] uppercase tracking-[0.18em] text-charcoal/40">
            This circle
          </p>
          <ul className="mt-2 space-y-1">
            {INVITED_ACCOUNTS.map((account) => (
              <li
                key={account.id}
                className="flex items-center justify-between gap-3 font-sans text-[0.74rem] text-charcoal/60"
              >
                <span>{account.email}</span>
                <span className="text-[0.62rem] uppercase tracking-[0.12em] text-charcoal/35">
                  {isRegistered(account.email) ? 'registered' : 'invite pending'}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 font-sans text-[0.64rem] leading-relaxed text-charcoal/40">
            Only these two addresses can sign in. Each account has its own private notebook and
            there is no way to switch into the other person&rsquo;s account.
          </p>
        </div>
      </form>
    </AuthLayout>
  );
}
