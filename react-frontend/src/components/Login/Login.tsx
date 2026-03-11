import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { baseURL } from '../Analytics/api';
import { Button } from '../ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';

const REQUEST_SUBMITTED_STORAGE_KEY = 'requestSubmittedEmail';
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
  const [checked1, setChecked1] = useState(false);
  const [checked2, setChecked2] = useState(false);
  const [checked3, setChecked3] = useState(false);
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
  const canSignIn = checked1 && checked2 && checked3;
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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-zinc-950 px-4 py-12 sm:px-6 lg:px-8">
      {/* Single soft gradient — calm, no clutter */}
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.15),transparent_50%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_100%,rgba(82,82,91,0.12),transparent_50%)]"
        aria-hidden
      />

      <Card className="relative z-10 w-full max-w-md border border-zinc-800/80 bg-zinc-900/60 shadow-2xl shadow-black/40 backdrop-blur-xl sm:max-w-md rounded-2xl overflow-hidden">
        {/* Subtle top edge highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-500/40 to-transparent" aria-hidden />

        <CardHeader className="space-y-2 text-center pb-2">
          <CardTitle className="text-xl font-semibold tracking-tight text-zinc-100">
            Template Checker
          </CardTitle>
          <CardDescription className="text-sm text-zinc-400">
            Validate and check Frontify templates
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-2">
          <p className="text-xs text-zinc-500">
            I know these acknowledgments are annoying, but I want to make sure expectations are set.
          </p>

          <div className="space-y-1">
            <p className="text-xs text-zinc-500 mb-1">Check each box to continue</p>
            <label
              htmlFor="ack1"
              className="flex items-center gap-3 cursor-pointer group rounded-lg py-1.5 px-2 -mx-2 -my-1 hover:bg-zinc-800/50 transition-colors"
            >
              <Checkbox
                id="ack1"
                checked={checked1}
                onCheckedChange={(value) => setChecked1(value === true)}
                className="shrink-0 h-5 w-5 border-2 border-zinc-500 data-[state=checked]:bg-zinc-100 data-[state=checked]:border-zinc-100 data-[state=checked]:text-zinc-900 group-hover:border-zinc-400 transition-colors"
              />
              <span className="text-xs text-zinc-300 group-hover:text-zinc-200 transition-colors leading-relaxed">
                I understand this is a workaround <strong className="font-medium text-zinc-100">NOT A SOLUTION</strong>.
              </span>
            </label>
            <label
              htmlFor="ack2"
              className="flex items-center gap-3 cursor-pointer group rounded-lg py-1.5 px-2 -mx-2 -my-1 hover:bg-zinc-800/50 transition-colors"
            >
              <Checkbox
                id="ack2"
                checked={checked2}
                onCheckedChange={(value) => setChecked2(value === true)}
                className="shrink-0 h-5 w-5 border-2 border-zinc-500 data-[state=checked]:bg-zinc-100 data-[state=checked]:border-zinc-100 data-[state=checked]:text-zinc-900 group-hover:border-zinc-400 transition-colors"
              />
              <span className="text-xs text-zinc-300 group-hover:text-zinc-200 transition-colors leading-relaxed">
                I understand this is River&apos;s weekend project and <strong className="font-medium text-zinc-100">not a Frontify sponsored Template Checker</strong>.
              </span>
            </label>
            <label
              htmlFor="ack3"
              className="flex items-center gap-3 cursor-pointer group rounded-lg py-1.5 px-2 -mx-2 -my-1 hover:bg-zinc-800/50 transition-colors"
            >
              <Checkbox
                id="ack3"
                checked={checked3}
                onCheckedChange={(value) => setChecked3(value === true)}
                className="shrink-0 h-5 w-5 border-2 border-zinc-500 data-[state=checked]:bg-zinc-100 data-[state=checked]:border-zinc-100 data-[state=checked]:text-zinc-900 group-hover:border-zinc-400 transition-colors"
              />
              <span className="text-xs text-zinc-300 group-hover:text-zinc-200 transition-colors leading-relaxed">
                I understand there is <strong className="font-medium text-zinc-100">no expectation of maintenance</strong>.
              </span>
            </label>
          </div>

          <Button
            className="h-11 w-full rounded-xl bg-white text-zinc-900 font-medium shadow-lg shadow-black/20 hover:bg-zinc-100 transition-colors"
            onClick={signInWithGoogle}
            disabled={!canSignIn || loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                <GoogleIcon className="h-5 w-5" />
                Sign in with Google
              </>
            )}
          </Button>

          {authErrorFromUrl && (
            <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" aria-hidden />
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-200">Sign-in issue</p>
                <p className="text-sm text-zinc-300">{authErrorFromUrl}</p>
                <button
                  type="button"
                  onClick={() => setAuthErrorFromUrl(null)}
                  className="text-xs text-amber-300 hover:text-amber-200 underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <div className="border-t border-zinc-800" />

          <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/20 px-4 py-4 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 text-center">
              Need access?
            </p>
            {submittedEmail ? (
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400/90 mt-0.5" aria-hidden />
                <p className="text-sm leading-relaxed text-zinc-300">
                  We&apos;ve submitted an access request for <span className="font-medium text-zinc-100">{submittedEmail}</span>. An admin will review it shortly.
                </p>
              </div>
            ) : showAccessDenied ? (
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 shrink-0 text-amber-400/90 mt-0.5" aria-hidden />
                <p className="text-sm leading-relaxed text-zinc-300">
                  Your account isn&apos;t authorized yet. Enter your email and tell us why you need access below.
                </p>
              </div>
            ) : null}
            {showRequestForm && !submittedEmail ? (
              <form onSubmit={handleSubmitAccessRequest} className="space-y-2">
                <Input
                  type="email"
                  placeholder="you@company.com"
                  value={requestEmail}
                  onChange={(e) => { setRequestEmail(e.target.value); setRequestError(null); }}
                  disabled={requestSubmitting}
                  className="h-10 bg-zinc-800/50 border-zinc-600 text-zinc-100 placeholder:text-zinc-500"
                  autoFocus
                />
                <textarea
                  placeholder="Why do you need access?"
                  value={requestWhy}
                  onChange={(e) => { setRequestWhy(e.target.value); setRequestError(null); }}
                  disabled={requestSubmitting}
                  rows={3}
                  className="w-full rounded-md border border-zinc-600 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-0 focus:ring-offset-zinc-900 disabled:opacity-50"
                  aria-label="Why you need access"
                />
                {requestError && (
                  <p className="text-xs text-amber-400">{requestError}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={requestSubmitting}
                    className="flex-1 h-10 border-zinc-600 bg-zinc-700/50 text-zinc-200 hover:bg-zinc-600/50 hover:text-zinc-100"
                  >
                    {requestSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit request'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => { setShowRequestForm(false); setRequestError(null); setRequestWhy(''); }}
                    disabled={requestSubmitting}
                    className="text-zinc-400 hover:text-zinc-200"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : !submittedEmail ? (
              <div className="pt-1 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowRequestForm(true)}
                  className="w-full border-zinc-600 bg-transparent text-zinc-300 hover:bg-zinc-700/50 hover:text-zinc-100 hover:border-zinc-500"
                >
                  <Mail className="h-4 w-4" aria-hidden />
                  Request access
                </Button>
              </div>
            ) : null}
          </div>

          <div className="border-t border-zinc-800" />

          <p className="text-center text-xs leading-relaxed text-zinc-500">
            PS: If the template checker saved your day, feel free to send a beer{' '}
            <span className="whitespace-nowrap">my way 😉</span>
            <br />
            Cheers to debugging🍺 — River
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
