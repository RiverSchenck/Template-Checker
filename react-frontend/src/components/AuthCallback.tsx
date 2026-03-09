import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { useAuth } from './AuthContext';

// Helper function to check if error is "not allowed" vs general auth error
const isNotAllowedError = (errorMessage: string): boolean => {
  if (!errorMessage) return false;
  const lowerMessage = errorMessage.toLowerCase();
  return (
    lowerMessage.includes('not authorized') ||
    lowerMessage.includes('email domain') ||
    lowerMessage.includes('email address is not authorized') ||
    lowerMessage.includes('domain or address is not authorized') ||
    lowerMessage.includes('not allowed') ||
    lowerMessage.includes('database error saving new user') ||
    lowerMessage.includes('database error')
  );
};

export default function AuthCallback() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'not_allowed' | 'general' | null>(null);
  const [loading, setLoading] = useState(true);
  /** Set when getSession() returns a session; we wait for context to have session before navigating. */
  const [sessionReceived, setSessionReceived] = useState(false);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Check for error in URL parameters or hash (implicit flow returns errors in hash)
        const errorDescription = searchParams.get('error_description');
        const errorCode = searchParams.get('error');
        const hashParams = new URLSearchParams(window.location.hash?.substring(1) || '');
        const hashError = hashParams.get('error_description') || hashParams.get('error');

        const allErrors = [errorDescription, errorCode, hashError].filter(Boolean);
        const errorMessage = allErrors[0] || '';

        if (errorCode || errorDescription || hashError) {
          console.error('OAuth error:', errorCode, errorDescription || hashError);
          const isNotAllowed = isNotAllowedError(errorMessage);
          setErrorType(isNotAllowed ? 'not_allowed' : 'general');
          setError(
            isNotAllowed
              ? "Your email domain or address isn't authorized yet. You'll be redirected to the sign-in page where you can submit an access request for an admin to review. If you need help, contact River."
              : errorMessage || 'Authentication failed. Please try again.'
          );
          setLoading(false);
          setTimeout(() => navigate('/'), isNotAllowed ? 5000 : 3000);
          return;
        }

        // Implicit flow: tokens are in the URL hash; Supabase parses them when detectSessionInUrl is true
        const { data, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Error getting session:', sessionError);
          const errorMsg = sessionError.message || '';
          const isNotAllowed = isNotAllowedError(errorMsg);
          setErrorType(isNotAllowed ? 'not_allowed' : 'general');
          setError(
            isNotAllowed
              ? "Your email domain or address isn't authorized yet. You'll be redirected to the sign-in page where you can submit an access request for an admin to review. If you need help, contact River."
              : errorMsg || 'Failed to complete authentication. Please try again.'
          );
          setLoading(false);
          setTimeout(() => navigate('/'), isNotAllowed ? 5000 : 3000);
          return;
        }

        if (data.session) {
          setLoading(false);
          setSessionReceived(true);
        } else {
          // No session yet (hash may not be processed); retry once
          const { data: retryData } = await supabase.auth.getSession();
          if (retryData.session) {
            setLoading(false);
            setSessionReceived(true);
          } else {
            setErrorType('general');
            setError('No session received. Please try signing in again.');
            setLoading(false);
            setTimeout(() => navigate('/'), 3000);
          }
        }
      } catch (err: unknown) {
        console.error('Auth callback error:', err);
        const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred during authentication.';
        const isNotAllowed = isNotAllowedError(errorMsg);
        setErrorType(isNotAllowed ? 'not_allowed' : 'general');
        setError(
          isNotAllowed
            ? "Your email domain or address isn't authorized yet. You'll be redirected to the sign-in page where you can submit an access request for an admin to review. If you need help, contact River."
            : errorMsg
        );
        setLoading(false);
        setTimeout(() => navigate('/'), isNotAllowed ? 5000 : 3000);
      }
    };

    handleAuthCallback();
  }, [navigate, searchParams]);

  // Only navigate after AuthProvider has the session (from onAuthStateChange). This prevents
  // ProtectedLayout from rendering once with session=null and briefly showing the login page.
  useEffect(() => {
    if (sessionReceived && session) {
      navigate('/', { replace: true });
    }
  }, [sessionReceived, session, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-5">
      {error ? (
        <Card className="w-full max-w-[500px] border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-destructive">
              {errorType === 'not_allowed' ? 'Access Denied' : 'Authentication Failed'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-primary underline underline-offset-2 hover:no-underline"
            >
              {errorType === 'not_allowed' ? 'Go to sign in and request access' : 'Go back to sign in'}
            </button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
          <span className="text-sm">Completing authentication...</span>
        </div>
      )}
    </div>
  );
}
