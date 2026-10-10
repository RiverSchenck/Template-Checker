import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SidebarInset, SidebarProvider } from './ui/sidebar';
import { SidebarMenu as SidebarMenuComponent } from './sidebar';
import { PageSkeleton } from './layout/PageSkeleton';
import { SiteHeader } from './site-header';
import Login from './Login/Login';
import { useAuth } from './AuthContext';
import { ValidationResult } from '../types';
import '../App.css';

export type ProtectedLayoutOutletContext = {
  checkerResults: ValidationResult | null;
  previousCheckerResults: ValidationResult | null;
  seeDetails: boolean;
  checkerResponse: (jsonResponse: ValidationResult, keepCurrentAsPrevious?: boolean) => void;
  setSeeDetails: (value: boolean) => void;
  navigateToResults: () => void;
};

export default function ProtectedLayout() {
  const [checkerResults, setCheckerResults] = useState<ValidationResult | null>(null);
  const [seeDetails, setSeeDetails] = useState<boolean>(false);
  const [previousCheckerResults, setPreviousCheckerResults] = useState<ValidationResult | null>(null);
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
  };

  return (
    <div className="app-background">
      <SidebarProvider>
        <SidebarMenuComponent checkerResults={checkerResults} />
        <SidebarInset className="min-w-0">
          <SiteHeader
            templateName={checkerResults?.template_name}
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
