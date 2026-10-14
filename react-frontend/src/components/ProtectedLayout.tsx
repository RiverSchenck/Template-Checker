import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SidebarInset, SidebarProvider } from './ui/sidebar';
import { SidebarMenu as SidebarMenuComponent } from './sidebar';
import { PageSkeleton } from './layout/PageSkeleton';
import { SiteHeader } from './site-header';
import Login from './Login/Login';
import { useAuth } from './AuthContext';
import { CheckResult } from '../types';

export type ProtectedLayoutOutletContext = {
  checkerResults: CheckResult | null;
  previousCheckerResults: CheckResult | null;
  checkerResponse: (jsonResponse: CheckResult, keepCurrentAsPrevious?: boolean) => void;
  navigateToResults: () => void;
};

export default function ProtectedLayout() {
  const [checkerResults, setCheckerResults] = useState<CheckResult | null>(null);
  const [previousCheckerResults, setPreviousCheckerResults] = useState<CheckResult | null>(null);
  const { session, loading, loadingRole, currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Restoring the session is near-instant; show the bare background rather than a flash of text.
  if (loading) {
    return <div className="app-background min-h-screen" aria-busy="true" />;
  }

  if (!session) {
    return <Login />;
  }

  // While /me verifies access, render the real shell with a placeholder for the page, so the app
  // appears once and nothing jumps when the content arrives.
  const verifying = loadingRole;

  // Backend is the single source of truth: only show app when we have currentUser from /me.
  if (!verifying && !currentUser) {
    return <Login />;
  }

  const checkerResponse = (jsonResponse: CheckResult, keepCurrentAsPrevious: boolean = false) => {
    setCheckerResults((current) => {
      if (keepCurrentAsPrevious && current) {
        setPreviousCheckerResults(current);
      } else {
        setPreviousCheckerResults(null);
      }
      return jsonResponse;
    });
  };

  const isAnalytics = location.pathname === '/analytics' || location.pathname.startsWith('/analytics');
  const contentWrapperClass = isAnalytics
    ? 'flex min-w-0 w-full flex-1 flex-col items-stretch justify-center overflow-x-hidden'
    : 'flex w-full flex-1 flex-col items-center justify-center min-h-[100vh]';

  const outletContext: ProtectedLayoutOutletContext = {
    checkerResults,
    previousCheckerResults,
    checkerResponse,
    navigateToResults: () => navigate('/results'),
  };

  return (
    <div className="app-background">
      <SidebarProvider>
        <SidebarMenuComponent checkerResults={checkerResults} />
        <SidebarInset className="min-w-0">
          <SiteHeader
            templateName={checkerResults?.results.template_name}
            checkerResults={checkerResults}
            checkerResponse={checkerResponse}
          />
          <div className={contentWrapperClass}>
            {verifying ? <PageSkeleton pathname={location.pathname} /> : <Outlet context={outletContext} />}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
