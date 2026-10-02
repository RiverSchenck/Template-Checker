import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarProvider,
} from './ui/sidebar';
import { SidebarMenu as SidebarMenuComponent } from './sidebar';
import { Skeleton } from './ui/skeleton';
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

  if (!session) {
    return <Login />;
  }

  // Don't show the app (avatar, sidebar, content) until we've verified access with /me.
  // Show full layout skeleton so the shell appears to load in.
  if (loadingRole) {
    return (
      <div className="app-background">
        <SidebarProvider>
          <Sidebar collapsible="offcanvas" variant="inset">
            <SidebarHeader>
              <SidebarMenu>
                <SidebarMenuItem>
                  <div className="px-2 py-1.5">
                    <Skeleton className="h-8 w-[140px] rounded" />
                  </div>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup className="pt-1">
                <SidebarGroupLabel className="h-auto min-h-0 px-2 pb-1.5 pt-0">
                  <Skeleton className="h-4 w-28" />
                </SidebarGroupLabel>
                <SidebarGroupContent className="px-2">
                  <SidebarMenuSkeleton showIcon className="mb-1" />
                  <SidebarMenuSkeleton showIcon className="mb-1" />
                  <SidebarMenuSkeleton showIcon className="mb-1" />
                </SidebarGroupContent>
              </SidebarGroup>
              <SidebarGroup>
                <SidebarGroupLabel className="h-auto min-h-0 px-2 pb-1.5 pt-0">
                  <Skeleton className="h-4 w-20" />
                </SidebarGroupLabel>
                <SidebarGroupContent className="px-2">
                  <SidebarMenuSkeleton showIcon className="mb-1" />
                  <SidebarMenuSkeleton showIcon className="mb-1" />
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
              <div className="flex items-center gap-2 p-2">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <Skeleton className="h-4 w-24 flex-1" />
              </div>
            </SidebarFooter>
          </Sidebar>
          <SidebarInset className="min-w-0">
            <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4 lg:px-6">
              <Skeleton className="h-6 w-6 shrink-0 rounded" />
              <Skeleton className="h-4 w-32" />
            </header>
            <div className="flex min-w-0 flex-1 flex-col p-6">
              <Skeleton className="mb-2 h-8 w-56" />
              <Skeleton className="mb-6 h-4 w-full max-w-md" />
              <Skeleton className="h-48 w-full rounded-lg" />
            </div>
          </SidebarInset>
        </SidebarProvider>
      </div>
    );
  }

  // Backend is the single source of truth: only show app when we have currentUser from /me.
  if (!currentUser) {
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
            <Outlet context={outletContext} />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
