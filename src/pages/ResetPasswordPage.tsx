import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, KeyRound } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AuthLayout } from '@/components/AuthLayout';
import { Button, Field, inputClass } from '@/components/ui/primitives';
import { updatePassword } from '@/services/auth';

/**
 * Two jobs:
 *  - arrived from the recovery email (session present, recoveryMode) → set a new password
 *  - arrived directly → ask for the address so the link can be sent
 */
export function ResetPasswordPage() {
  const { session, recoveryMode, clearRecovery, signOut } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const requestLink = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { requestPasswordReset } = await import('@/services/auth');
    const result = await requestPasswordReset(email);
    setBusy(false);
    if (result.ok) setSent(result.detail);
    else setError(result.detail);
  };

  const savePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await updatePassword(password);
    setBusy(false);
    if (!result.ok) {
      setError(result.detail);
      return;
    }
    clearRecovery();
    signOut();
    navigate('/login', { replace: true });
  };

  const canSetPassword = Boolean(recoveryMode && session);

  return (
    <AuthLayout
      eyebrow={canSetPassword ? 'Set a new password' : 'Forgot your password?'}
      title={canSetPassword ? 'Choose a new password' : 'We will send you a link'}
      subtitle={
        canSetPassword
          ? 'Your recovery link is valid for this session. Pick something you will remember.'
          : 'Enter your invited address and we will email a recovery link. Only the two invited addresses can reset a password.'
      }
      footer={
        <p className="font-sans text-[0.78rem] text-charcoal/55">
          <Link to="/login" className="font-medium text-forest underline underline-offset-4">
            Back to sign in
          </Link>
        </p>
      }
    >
      {canSetPassword ? (
        <form className="space-y-4" onSubmit={savePassword} noValidate>
          <Field label="New password" htmlFor="reset-password">
            <div className="relative">
              <KeyRound
                size={14}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal/30"
              />
              <input
                id="reset-password"
                type="password"
                autoComplete="new-password"
                className={`${inputClass} pl-9`}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                required
              />
            </div>
          </Field>
          <Field label="Confirm password" htmlFor="reset-confirm">
            <input
              id="reset-confirm"
              type="password"
              autoComplete="new-password"
              className={inputClass}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="Repeat password"
              required
            />
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
            {busy ? 'Saving…' : 'Save new password'}
          </Button>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={requestLink} noValidate>
          <Field label="Invited email address" htmlFor="reset-email">
            <input
              id="reset-email"
              type="email"
              autoComplete="email"
              className={inputClass}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </Field>
          {sent ? (
            <p className="rounded-[9px] border border-sage/50 bg-sage/10 px-3.5 py-2.5 font-sans text-[0.76rem] leading-relaxed text-forest">
              {sent}
            </p>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="rounded-[9px] border border-terracotta/40 bg-terracotta/[0.07] px-3.5 py-2.5 font-sans text-[0.76rem] leading-relaxed text-[#8a4f37]"
            >
              {error}
            </p>
          ) : null}
          <Button type="submit" full disabled={busy} iconRight={<ArrowRight size={14} />}>
            {busy ? 'Sending…' : 'Email me a reset link'}
          </Button>
          <p className="font-sans text-[0.66rem] leading-relaxed text-charcoal/40">
            Reset emails are sent by Supabase. If nothing arrives, ask the project owner to check the
            SMTP settings in Supabase → Authentication → Emails.
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
