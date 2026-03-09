import React from 'react';
import { BrowserRouter, Routes, Route, useOutletContext, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import FileUploadPage from './components/File Upload/FileUpload';
import ValidationList from './components/Validation List/ValidationList';
import { Analytics } from './components/Analytics';
import AuthCallback from './components/AuthCallback';
import ProtectedLayout, { type ProtectedLayoutOutletContext } from './components/ProtectedLayout';
import { UserManagement } from './components/Admin/UserManagement';
import { useAuth } from './components/AuthContext';

function FileUploadWrapper() {
  const ctx = useOutletContext<ProtectedLayoutOutletContext>();
  const seeDetails = (value: boolean) => ctx.setSeeDetails(!!value);
  return (
    <FileUploadPage
      checkerResponse={ctx.checkerResponse}
      seeDetails={seeDetails}
      navigateToResults={ctx.navigateToResults}
    />
  );
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAdmin, loadingRole } = useAuth();
  if (loadingRole) return <div className="p-6">Loading...</div>;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function ValidationListWrapper() {
  const ctx = useOutletContext<ProtectedLayoutOutletContext>();
  if (!ctx.checkerResults) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#666' }}>
        Run a check first to see results, or go back to Check Template.
      </div>
    );
  }
  return (
    <ValidationList
      jsonResponse={ctx.checkerResults}
      previousJsonResponse={ctx.previousCheckerResults ?? null}
      checkerResponse={ctx.checkerResponse}
      seeDetails={ctx.seeDetails}
      fromExtension={ctx.fromExtension}
    />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" />
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/" element={<ProtectedLayout />}>
          <Route index element={<FileUploadWrapper />} />
          <Route path="results" element={<ValidationListWrapper />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="admin/users" element={<AdminGuard><UserManagement /></AdminGuard>} />
          <Route path="admin/access-requests" element={<Navigate to="/admin/users#access-requests" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
