import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from './ui/sidebar';
import { SidebarMenu } from './sidebar';
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
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

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
            <Outlet context={outletContext} />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
