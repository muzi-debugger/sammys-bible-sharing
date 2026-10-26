import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Mail, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AuthLayout } from '@/components/AuthLayout';
import { Button, Field, inputClass } from '@/components/ui/primitives';
import { AuthError } from '@/services/auth';
import { isRemoteMode } from '@/lib/supabase';

export function RegisterPage() {
  const { session, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await register({ name, email, password });
      navigate('/', { replace: true });
    } catch (caught) {
      setError(
        caught instanceof AuthError ? caught.message : 'Unable to create the account. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Create your account"
      title="Set up your private journal"
      subtitle="Use the email address that was invited. Your name is used for the welcome message and your weekly email."
      footer={
        <p className="font-sans text-[0.78rem] text-charcoal/55">
          Already set up?{' '}
          <Link to="/login" className="font-medium text-forest underline underline-offset-4">
            Sign in instead
          </Link>
        </p>
      }
    >
      <form className="space-y-4" onSubmit={submit} noValidate>
        <Field label="Your name" htmlFor="register-name">
          <div className="relative">
            <User
              size={14}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal/30"
            />
            <input
              id="register-name"
              className={`${inputClass} pl-9`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Sam"
              autoComplete="name"
              required
            />
          </div>
        </Field>

        <Field
          label="Invited email address"
          htmlFor="register-email"
          hint="Only the two invited addresses in this circle can create an account."
        >
          <div className="relative">
            <Mail
              size={14}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal/30"
            />
            <input
              id="register-email"
              type="email"
              className={`${inputClass} pl-9`}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password" htmlFor="register-password">
            <div className="relative">
              <Lock
                size={14}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal/30"
              />
              <input
                id="register-password"
                type="password"
                className={`${inputClass} pl-9`}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
          </Field>
          <Field label="Confirm password" htmlFor="register-confirm">
            <div className="relative">
              <Lock
                size={14}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal/30"
              />
              <input
                id="register-confirm"
                type="password"
                className={`${inputClass} pl-9`}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder="Repeat password"
                autoComplete="new-password"
                required
              />
            </div>
          </Field>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-[9px] border border-terracotta/40 bg-terracotta/[0.07] px-3.5 py-2.5 font-sans text-[0.76rem] leading-relaxed text-[#8a4f37]"
          >
            {error}
          </p>
        ) : null}



        <Button type="submit" full disabled={busy} iconRight={<ArrowRight size={14} />}>
          {busy ? 'Creating account…' : 'Create my account'}
        </Button>

        <p className="font-sans text-[0.66rem] leading-relaxed text-charcoal/40">
          {isRemoteMode
            ? 'Your password is handled by Supabase Auth. Your notebook is scoped to your own account and protected by row level security — no one else can open it.'
            : 'Your password is stored only in this browser for the preview, and your notebook is scoped to your own account. No one else can open it.'}
        </p>
      </form>
    </AuthLayout>
  );
}
