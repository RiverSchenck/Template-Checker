import React from 'react';
import ReactDOM from 'react-dom/client';
import './globals.css';
import './App.css';
import App from './App';
import { AuthProvider } from './components/AuthContext';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
if (import.meta.env.DEV && import.meta.env.VITE_SAMPLE_DATA === 'true') {
  // `npm run dev:sample`: signed-in admin + sample analytics, no backend needed. Never in production builds.
  import('./dev/sampleMode').then(({ renderWithSampleData }) => renderWithSampleData(root));
} else {
  root.render(
    <React.StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </React.StrictMode>
  );
}
