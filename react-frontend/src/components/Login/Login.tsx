import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertCircle, FileCheck2, X } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { baseURL } from '../Analytics/api';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';

const REQUEST_SUBMITTED_STORAGE_KEY = 'requestSubmittedEmail';

/** Everyone confirms these before signing in. */
const ACKNOWLEDGEMENTS: React.ReactNode[] = [
  <>
    This is a workaround, <strong className="font-medium text-zinc-100">not a solution</strong>.
  </>,
  <>
    This is River&apos;s weekend project and{' '}
    <strong className="font-medium text-zinc-100">not a Frontify-sponsored Template Checker</strong>.
  </>,
  <>
    There is <strong className="font-medium text-zinc-100">no expectation of maintenance</strong>.
  </>,
];
/** Set by AuthContext when user gets 403 so we can pre-fill email and show the request form. */
const ACCESS_DENIED_EMAIL_KEY = 'template-checker-accessDeniedEmail';

/** Supabase OAuth errors often land on / with ?error=...&error_description=... */
function getAuthErrorFromUrl(searchParams: URLSearchParams): string | null {
  const error = searchParams.get('error');
  const desc = searchParams.get('error_description') || '';
  if (!error || !desc) return null;
  const lower = desc.toLowerCase();
  if (error === 'server_error' && (lower.includes('database') || lower.includes('saving new user'))) {
    return "We couldn't complete sign-in. This usually means your email domain isn't allowed yet in our auth system. Please contact River with your email so we can add you, or try again later.";
  }
  if (error === 'access_denied' || lower.includes('not allowed') || lower.includes('not authorized')) {
    return "Sign-in was denied. Please contact River if you need access.";
  }
  return desc || 'Sign-in failed. Please try again.';
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="currentColor"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="currentColor"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="currentColor"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function Login() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { signInWithGoogle, loading, accessDenied, requestSubmittedForEmail } = useAuth();
  const [acknowledged, setAcknowledged] = useState<boolean[]>(() => ACKNOWLEDGEMENTS.map(() => false));
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestEmail, setRequestEmail] = useState('');
  const [requestWhy, setRequestWhy] = useState('');
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSubmittedEmail, setRequestSubmittedEmail] = useState<string | null>(null);
  const [authErrorFromUrl, setAuthErrorFromUrl] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(REQUEST_SUBMITTED_STORAGE_KEY);
      if (stored) {
        setRequestSubmittedEmail(stored);
        sessionStorage.removeItem(REQUEST_SUBMITTED_STORAGE_KEY);
      }
      const accessDeniedEmail = sessionStorage.getItem(ACCESS_DENIED_EMAIL_KEY);
      if (accessDeniedEmail) {
        sessionStorage.removeItem(ACCESS_DENIED_EMAIL_KEY);
        setRequestEmail(accessDeniedEmail.trim());
        setShowRequestForm(true);
      }
    } catch {
      // ignore
    }
  }, []);

  // Supabase OAuth errors redirect to / with ?error=...&error_description=... — show message and clean URL
  useEffect(() => {
    const message = getAuthErrorFromUrl(searchParams);
    if (message) {
      setAuthErrorFromUrl(message);
      const next = new URLSearchParams(searchParams);
      next.delete('error');
      next.delete('error_code');
      next.delete('error_description');
      const qs = next.toString();
      navigate({ pathname: '/', search: qs ? `?${qs}` : '', hash: '' }, { replace: true });
    }
  }, [searchParams, navigate]);

  const showAccessDenied = accessDenied || searchParams.get('accessDenied') === '1';
  const acknowledgedCount = acknowledged.filter(Boolean).length;
  const canSignIn = acknowledgedCount === ACKNOWLEDGEMENTS.length;
  const submittedEmail = requestSubmittedForEmail || requestSubmittedEmail;

  const handleSubmitAccessRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = requestEmail.trim();
    if (!email || !email.includes('@')) {
      setRequestError('Please enter a valid email address.');
      return;
    }
    const why = requestWhy.trim();
    if (!why) {
      setRequestError('Please tell us why you need access.');
      return;
    }
    setRequestError(null);
    setRequestSubmitting(true);
    try {
      const res = await fetch(`${baseURL}/access-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Source': 'react-frontend' },
        body: JSON.stringify({ email, why_need_access: why }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setRequestSubmittedEmail(email);
        setRequestEmail('');
        setRequestWhy('');
        setShowRequestForm(false);
      } else {
        setRequestError(data?.error?.message || 'Failed to submit request. Please try again.');
      }
    } catch {
      setRequestError('Failed to submit request. Please try again.');
    } finally {
      setRequestSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 py-12 text-zinc-100">
      <main className="w-full max-w-[420px]">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl shadow-black/30 sm:p-8">
          <header className="text-center">
            <h1 className="flex items-center justify-center gap-2 text-lg font-semibold tracking-tight">
              <FileCheck2 className="h-5 w-5 text-zinc-400" strokeWidth={1.75} aria-hidden />
              Template Checker
            </h1>
            <p className="mt-1 text-sm text-zinc-400">Validate and check Frontify templates</p>
          </header>

          {authErrorFromUrl && (
            <div role="alert" className="mt-6 flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-amber-200">Sign-in issue</p>
                <p className="mt-0.5 text-sm leading-relaxed text-zinc-300">{authErrorFromUrl}</p>
              </div>
              <button
                type="button"
                onClick={() => setAuthErrorFromUrl(null)}
                className="grid h-5 w-5 shrink-0 place-items-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <section className="mt-7" aria-labelledby="ack-heading">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="ack-heading" className="text-sm font-medium">Before you sign in</h2>
              <span className="text-xs tabular-nums text-zinc-500" aria-live="polite">
                {acknowledgedCount} of {ACKNOWLEDGEMENTS.length}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              I know these are annoying, but I want to make sure expectations are set.
            </p>
            <div className="mt-3 divide-y divide-zinc-800 overflow-hidden rounded-lg border border-zinc-800">
              {ACKNOWLEDGEMENTS.map((text, i) => (
                <label
                  key={i}
                  htmlFor={`ack${i + 1}`}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 px-3.5 py-3 transition-colors hover:bg-zinc-800/60',
                    acknowledged[i] && 'bg-zinc-800/40'
                  )}
                >
                  <Checkbox
                    id={`ack${i + 1}`}
                    checked={acknowledged[i]}
                    onCheckedChange={(value) =>
                      setAcknowledged((prev) => prev.map((v, j) => (j === i ? value === true : v)))
                    }
                    className="mt-0.5 h-4 w-4 shrink-0 border-zinc-500 data-[state=checked]:border-zinc-100 data-[state=checked]:bg-zinc-100 data-[state=checked]:text-zinc-900"
                  />
                  <span className={cn('text-sm leading-snug transition-colors', acknowledged[i] ? 'text-zinc-200' : 'text-zinc-400')}>
                    {text}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <Button
            className="mt-5 h-10 w-full rounded-lg bg-white font-medium text-zinc-900 hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:opacity-100"
            onClick={signInWithGoogle}
            disabled={!canSignIn || loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                <GoogleIcon className="h-4 w-4" />
                Sign in with Google
              </>
            )}
          </Button>
          {!canSignIn && !loading && (
            <p className="mt-2 text-center text-xs text-zinc-500">Check all three to continue.</p>
          )}

          <div className="mt-6 border-t border-zinc-800 pt-5">
            {submittedEmail ? (
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                <p className="text-sm leading-relaxed text-zinc-300">
                  Access requested for <span className="font-medium text-zinc-100">{submittedEmail}</span>. An admin will
                  review it shortly.
                </p>
              </div>
            ) : showRequestForm ? (
              <form onSubmit={handleSubmitAccessRequest} className="space-y-3">
                {showAccessDenied ? (
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
                    <p className="text-sm leading-relaxed text-zinc-300">
                      Your account isn&apos;t authorized yet. Tell us who you are and why you need access.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm font-medium">Request access</p>
                )}
                <Input
                  type="email"
                  placeholder="you@company.com"
                  value={requestEmail}
                  onChange={(e) => { setRequestEmail(e.target.value); setRequestError(null); }}
                  disabled={requestSubmitting}
                  className="h-10 border-zinc-700 bg-zinc-950/40 text-zinc-100 placeholder:text-zinc-500"
                  aria-label="Your email"
                  autoFocus
                />
                <textarea
                  placeholder="Why do you need access?"
                  value={requestWhy}
                  onChange={(e) => { setRequestWhy(e.target.value); setRequestError(null); }}
                  disabled={requestSubmitting}
                  rows={3}
                  className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
                  aria-label="Why you need access"
                />
                {requestError && <p className="text-xs text-amber-400">{requestError}</p>}
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={requestSubmitting}
                    className="h-9 flex-1 border border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                  >
                    {requestSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit request'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => { setShowRequestForm(false); setRequestError(null); setRequestWhy(''); }}
                    disabled={requestSubmitting}
                    className="h-9 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <p className="text-center text-sm text-zinc-400">
                {showAccessDenied ? "Your account isn't authorized yet. " : "Don't have access? "}
                <button
                  type="button"
                  onClick={() => setShowRequestForm(true)}
                  className="font-medium text-zinc-100 underline decoration-zinc-600 underline-offset-4 hover:decoration-zinc-300"
                >
                  Request access
                </button>
              </p>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-zinc-500">
          Saved your day? Feel free to send a beer my way 🍺 — River
        </p>
      </main>
    </div>
  );
}
