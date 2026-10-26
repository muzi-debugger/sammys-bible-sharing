import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Mail } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AuthLayout } from '@/components/AuthLayout';
import { Button, Field, inputClass } from '@/components/ui/primitives';
import { AuthError } from '@/services/auth';
import { identitiesConfigured } from '@/lib/identities';

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
        {!identitiesConfigured ? (
          <p
            role="status"
            className="rounded-[9px] border border-gold/45 bg-gold/[0.08] px-3.5 py-2.5 font-sans text-[0.74rem] leading-relaxed text-[#8a6f3f]"
          >
            This build has no partner addresses configured. Set
            <code className="mx-1 font-mono text-[0.7rem]">VITE_PARTNER_ONE_EMAIL</code>
            and
            <code className="mx-1 font-mono text-[0.7rem]">VITE_PARTNER_TWO_EMAIL</code>
            and rebuild.
          </p>
        ) : null}

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

        <p className="flex items-start gap-2 font-sans text-[0.66rem] leading-relaxed text-charcoal/40">
          <Lock size={11} className="mt-[3px] shrink-0 text-forest/40" />
          Access is limited to two invited addresses. Each has its own private notebook, and there is
          no way to switch into the other person&rsquo;s account.
        </p>
      </form>
    </AuthLayout>
  );
}
