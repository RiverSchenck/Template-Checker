import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from './ui/sidebar';
import { SidebarMenu } from './sidebar';
import { SiteHeader } from './site-header';
import Login from './Login/Login';
import { useAuth } from './AuthContext';
import { baseURL, getAuthHeaders } from './Analytics/api';
import { ValidationResult } from '../types';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import '../App.css';

export type ProtectedLayoutOutletContext = {
  checkerResults: ValidationResult | null;
  previousCheckerResults: ValidationResult | null;
  seeDetails: boolean;
  checkerResponse: (jsonResponse: ValidationResult, keepCurrentAsPrevious?: boolean) => void;
  setSeeDetails: (value: boolean) => void;
  navigateToResults: () => void;
  fromExtension: boolean;
};

export default function ProtectedLayout() {
  const [checkerResults, setCheckerResults] = useState<ValidationResult | null>(null);
  const [seeDetails, setSeeDetails] = useState<boolean>(false);
  const [previousCheckerResults, setPreviousCheckerResults] = useState<ValidationResult | null>(null);
  const { user, session, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const checkUrlProcessedRef = useRef(false);
  const [fromExtension, setFromExtension] = useState(false);
  const [checkFromUrlInProgress, setCheckFromUrlInProgress] = useState(false);

  // Auto-run check from ?checkUrl= param (e.g. from extension). Template is fetched by the backend only — no local download.
  useEffect(() => {
    const checkUrl = searchParams.get('checkUrl');
    if (!checkUrl || !session?.access_token || checkUrlProcessedRef.current) return;

    checkUrlProcessedRef.current = true;
    setFromExtension(true);
    setCheckFromUrlInProgress(true);
    const clearParam = () => {
      searchParams.delete('checkUrl');
      setSearchParams(searchParams, { replace: true });
    };

    const run = async () => {
      try {
        const res = await fetch(`${baseURL}/run-from-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(session.access_token),
            'X-Source': 'extension', // Check initiated from extension (checkUrl); backend uses this for analytics
          },
          body: JSON.stringify({ downloadUrl: checkUrl }),
        });
        const data = await res.json();
        const results: ValidationResult = data?.content?.results;
        if (!results) throw new Error(data?.error?.message || 'Invalid response');
        setSeeDetails(false);
        setCheckerResults((current) => {
          setPreviousCheckerResults(null);
          return results;
        });
        clearParam();
        navigate('/results');
        toast.success('Template checked');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Check failed';
        toast.error(msg);
        clearParam();
      } finally {
        setCheckFromUrlInProgress(false);
      }
    };

    run();
  }, [session?.access_token, searchParams, setSearchParams, navigate]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <div>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const checkerResponse = (jsonResponse: ValidationResult, keepCurrentAsPrevious: boolean = false) => {
    setSeeDetails(false);
    setCheckerResults((current) => {
      if (keepCurrentAsPrevious && current) {
        setPreviousCheckerResults(current);
      } else {
        setPreviousCheckerResults(null);
      }
      return jsonResponse;
    });
  };

  const handleSeeDetails = (value: boolean) => {
    setSeeDetails(value);
  };

  const isAnalytics = location.pathname === '/analytics' || location.pathname.startsWith('/analytics');
  const contentWrapperClass = isAnalytics
    ? 'flex min-w-0 w-full flex-1 flex-col items-stretch justify-center overflow-x-hidden'
    : 'flex w-full flex-1 flex-col items-center justify-center min-h-[100vh]';

  const outletContext: ProtectedLayoutOutletContext = {
    checkerResults,
    previousCheckerResults,
    seeDetails,
    checkerResponse,
    setSeeDetails: handleSeeDetails,
    navigateToResults: () => navigate('/results'),
    fromExtension,
  };

  return (
    <div className="app-background">
      <SidebarProvider>
        <SidebarMenu checkerResults={checkerResults} />
        <SidebarInset className="min-w-0">
          <SiteHeader
            templateName={checkerResults?.template_name}
            checkerResults={checkerResults}
            checkerResponse={checkerResponse}
          />
          <div className={contentWrapperClass}>
            {checkFromUrlInProgress ? (
              <motion.div
                className="flex min-h-[60vh] flex-col items-center justify-center px-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <motion.div
                  className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/90 to-white/70 px-10 py-12 shadow-2xl shadow-black/10 backdrop-blur-xl dark:from-neutral-900/95 dark:to-neutral-800/90 dark:border-white/5"
                  initial={{ opacity: 0, scale: 0.96, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.15),transparent)]" />
                  <div className="relative flex flex-col items-center gap-8">
                    <div className="relative h-20 w-20">
                      <svg className="h-full w-full" viewBox="0 0 100 100">
                        <defs>
                          <linearGradient id="loader-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="hsl(var(--primary))" />
                            <stop offset="100%" stopColor="#8B5CF6" />
                          </linearGradient>
                        </defs>
                        <circle
                          cx="50"
                          cy="50"
                          r="42"
                          fill="none"
                          stroke="url(#loader-gradient)"
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeDasharray="66 198"
                          className="animate-loader-dash"
                        />
                      </svg>
                    </div>
                    <div className="space-y-2 text-center">
                      <motion.p
                        className="bg-gradient-to-r from-primary via-violet-600 to-primary bg-[length:200%_auto] bg-clip-text text-xl font-semibold tracking-tight text-transparent"
                        style={{ animation: 'gradient-shift 3s ease infinite' }}
                      >
                        Checking template from Frontify
                      </motion.p>
                      <p className="text-sm text-muted-foreground">
                        Validating your template
                      </p>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            ) : (
              <Outlet context={outletContext} />
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
