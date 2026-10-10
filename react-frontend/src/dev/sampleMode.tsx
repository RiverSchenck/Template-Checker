/**
 * Dev-only sample data mode: run `npm run dev:sample` to see the app signed in as an admin, with the analytics
 * and summary feedback endpoints answered from src/dev/sampleData.ts. No backend or Supabase project needed.
 *
 * index.tsx only imports this behind `import.meta.env.DEV`, so it never ships in a production build.
 */
import React from 'react';
import type { Root } from 'react-dom/client';
import type { Session, User } from '@supabase/supabase-js';
import App from '../App';
import { AuthContext, type AuthContextType } from '../components/AuthContext';
import { baseURL } from '../components/Analytics/api';
import {
  SAMPLE_ADMIN_ID,
  sampleAdminSummaryFeedback,
  sampleIssueDetail,
  sampleMySummaryFeedback,
  sampleOverview,
  sampleResolveSummaryComment,
  sampleRuns,
  sampleRunsCsv,
} from './sampleData';

const SAMPLE_USER = {
  id: SAMPLE_ADMIN_ID,
  email: 'admin@example.com',
  display_name: 'Sample Admin',
  avatar_url: null,
  role: 'admin' as const,
};

const auth: AuthContextType = {
  user: { id: SAMPLE_USER.id, email: SAMPLE_USER.email } as User,
  session: { access_token: 'sample', user: { id: SAMPLE_USER.id } } as Session,
  currentUser: SAMPLE_USER,
  loading: false,
  role: 'admin',
  loadingRole: false,
  isAdmin: true,
  accessDenied: false,
  requestSubmittedForEmail: null,
  clearAccessDenied: () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {
    window.alert('Sample data mode: there is no real session to sign out of.');
  },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Answer backend calls from the sample dataset, with a little latency so loading states are visible. */
function installFetchMock() {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (!url.href.startsWith(baseURL)) return realFetch(input, init);

    await new Promise((resolve) => setTimeout(resolve, 250 + Math.random() * 250));
    const path = url.pathname;
    const params = url.searchParams;

    if (path === '/analytics/overview') return json(sampleOverview(params));
    if (path === '/analytics/runs') return json(sampleRuns(params));
    if (path === '/analytics/runs.csv') {
      const { csv, total, exported } = sampleRunsCsv(params);
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="template-checks-sample.csv"',
          'X-Total-Rows': String(total),
          'X-Exported-Rows': String(exported),
        },
      });
    }
    const issue = path.match(/^\/analytics\/issues\/([^/]+)$/);
    if (issue) return json(sampleIssueDetail(decodeURIComponent(issue[1]), params));
    if (path === '/me') return json(SAMPLE_USER);
    if (path.startsWith('/admin/access-requests')) return json([]);
    if (path === '/summary-reviews/mine') return json(sampleMySummaryFeedback(SAMPLE_USER.id));
    if (path === '/admin/summary-feedback') return json(sampleAdminSummaryFeedback(params));
    const comment = path.match(/^\/admin\/summary-feedback\/([^/]+)$/);
    if (comment && init?.method === 'PATCH') {
      const { resolved } = JSON.parse(String(init.body ?? '{}'));
      if (typeof resolved !== 'boolean') return json({ error: { message: 'resolved must be true or false' } }, 400);
      const updated = sampleResolveSummaryComment(decodeURIComponent(comment[1]), resolved);
      return updated ? json(updated) : json({ error: { message: 'Comment not found' } }, 404);
    }
    return json({ error: { message: `Not available in sample data mode: ${path}` } }, 404);
  };
}

export function renderWithSampleData(root: Root) {
  installFetchMock();
  console.info('[sample data] Analytics and summary feedback endpoints are answered from src/dev/sampleData.ts');
  root.render(
    <React.StrictMode>
      <AuthContext.Provider value={auth}>
        <App />
      </AuthContext.Provider>
    </React.StrictMode>
  );
}
