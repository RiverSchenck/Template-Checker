import React from 'react';
import { BrowserRouter, Routes, Route, useOutletContext } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import FileUploadPage from './components/File Upload/FileUpload';
import ValidationList from './components/Validation List/ValidationList';
import { Analytics } from './components/Analytics';
import AuthCallback from './components/AuthCallback';
import ProtectedLayout, { type ProtectedLayoutOutletContext } from './components/ProtectedLayout';

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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
