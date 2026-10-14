import React from 'react';
import { BrowserRouter, Routes, Route, useOutletContext, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import FileUploadPage from './components/File Upload/FileUpload';
import ReportView from './components/Report/ReportView';
import { AnalyticsApi, AnalyticsChecks, AnalyticsLayout, AnalyticsOperations, AnalyticsOverview } from './components/Analytics';
import AuthCallback from './components/AuthCallback';
import ProtectedLayout, { type ProtectedLayoutOutletContext } from './components/ProtectedLayout';
import { UserManagement } from './components/Admin/UserManagement';
import { ApiKeys } from './components/ApiKeys/ApiKeys';
import { SummaryFeedbackAdmin } from './components/SummaryFeedback/SummaryFeedbackAdmin';
import { MyFeedback } from './components/SummaryFeedback/MyFeedback';
import { useAuth } from './components/AuthContext';

function FileUploadWrapper() {
  const ctx = useOutletContext<ProtectedLayoutOutletContext>();
  return (
    <FileUploadPage
      checkerResponse={ctx.checkerResponse}
      navigateToResults={ctx.navigateToResults}
    />
  );
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin, loadingRole } = useAuth();
  // ProtectedLayout shows the page skeleton while the role loads.
  if (loadingRole) return null;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function ResultsPage() {
  const ctx = useOutletContext<ProtectedLayoutOutletContext>();
  if (!ctx.checkerResults) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Run a check first to see results, or go back to Check Template.
      </div>
    );
  }
  return (
    <div className="h-full w-full min-w-0 overflow-x-hidden">
      <div className="mx-auto w-full max-w-[1400px] px-4 pt-3 sm:px-[3%]">
        <ReportView result={ctx.checkerResults} previous={ctx.previousCheckerResults ?? null} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="bottom-right" visibleToasts={3} offset={20} />
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/" element={<ProtectedLayout />}>
          <Route index element={<FileUploadWrapper />} />
          <Route path="results" element={<ResultsPage />} />
          <Route path="analytics" element={<AnalyticsLayout />}>
            <Route index element={<AnalyticsOverview />} />
            <Route path="operations" element={<AdminGuard><AnalyticsOperations /></AdminGuard>} />
            <Route path="checks" element={<AdminGuard><AnalyticsChecks /></AdminGuard>} />
            <Route path="api" element={<AdminGuard><AnalyticsApi /></AdminGuard>} />
          </Route>
          <Route path="api-keys" element={<ApiKeys />} />
          <Route path="my-feedback" element={<MyFeedback />} />
          <Route path="admin/users" element={<AdminGuard><UserManagement /></AdminGuard>} />
          <Route path="admin/summary-feedback" element={<AdminGuard><SummaryFeedbackAdmin /></AdminGuard>} />
          <Route path="admin/access-requests" element={<Navigate to="/admin/users#access-requests" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
