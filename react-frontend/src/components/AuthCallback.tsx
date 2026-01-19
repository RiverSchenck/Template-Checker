import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { Alert, Spin } from 'antd';

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
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'not_allowed' | 'general' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Check for error in URL parameters or hash
        const errorDescription = searchParams.get('error_description');
        const errorCode = searchParams.get('error');
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const hashError = hashParams.get('error_description') || hashParams.get('error');

        // Combine all error sources
        const allErrors = [errorDescription, errorCode, hashError].filter(Boolean);
        const errorMessage = allErrors[0] || '';

        if (errorCode || errorDescription || hashError) {
          console.error('OAuth error:', errorCode, errorDescription || hashError);

          const isNotAllowed = isNotAllowedError(errorMessage);
          setErrorType(isNotAllowed ? 'not_allowed' : 'general');
          setError(
            isNotAllowed
              ? 'Your email domain or address is not authorized. Please contact river if you need access.'
              : errorMessage || 'Authentication failed. Please try again.'
          );
          setLoading(false);

          setTimeout(() => {
            navigate('/');
          }, isNotAllowed ? 5000 : 3000);
          return;
        }

        // Exchange the code for a session
        const { data, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Error getting session:', sessionError);

          const errorMsg = sessionError.message || '';
          const isNotAllowed = isNotAllowedError(errorMsg);
          setErrorType(isNotAllowed ? 'not_allowed' : 'general');
          setError(
            isNotAllowed
              ? 'Your email domain or address is not authorized. Please contact river if you need access.'
              : errorMsg || 'Failed to complete authentication. Please try again.'
          );
          setLoading(false);

          setTimeout(() => {
            navigate('/');
          }, isNotAllowed ? 5000 : 3000);
          return;
        }

        if (data.session) {
          // Successfully authenticated - navigate to main app
          navigate('/');
        } else {
          // No session - likely rejected by database trigger
          // Try to get more info by checking the hash or waiting a bit
          setTimeout(async () => {
            // Check one more time after a delay
            const { data: retryData } = await supabase.auth.getSession();
            if (!retryData.session) {
              setErrorType('not_allowed');
              setError('Your email domain or address is not authorized. Please contact river if you need access.');
              setLoading(false);

              setTimeout(() => {
                navigate('/');
              }, 5000);
            }
          }, 1000);
        }
      } catch (error: any) {
        console.error('Auth callback error:', error);
        const errorMsg = error?.message || 'An unexpected error occurred during authentication.';
        const isNotAllowed = isNotAllowedError(errorMsg);
        setErrorType(isNotAllowed ? 'not_allowed' : 'general');
        setError(isNotAllowed
          ? 'Your email domain or address is not authorized. Please contact river if you need access.'
          : errorMsg
        );
        setLoading(false);

        setTimeout(() => {
          navigate('/');
        }, isNotAllowed ? 5000 : 3000);
      }
    };

    handleAuthCallback();
  }, [navigate, searchParams]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      padding: '20px'
    }}>
      {error ? (
        <Alert
          message={errorType === 'not_allowed' ? 'Access Denied' : 'Authentication Failed'}
          description={error}
          type="error"
          showIcon
          style={{ maxWidth: '500px' }}
        />
      ) : (
        <Spin size="large" tip="Completing authentication..." />
      )}
    </div>
  );
}
