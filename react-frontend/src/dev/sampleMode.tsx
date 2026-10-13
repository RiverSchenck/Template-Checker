/**
 * Dev-only sample data mode: run `npm run dev:sample` to see the app signed in as an admin, with the analytics
 * and summary feedback endpoints answered from src/dev/sampleData.ts, and checks answered from src/fixtures (real
 * results from the backend's goldens: upload any .zip, named like a fixture, e.g. brochure.zip, to pick one). No
 * backend or Supabase project needed.
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

const FIXTURES = import.meta.glob('../fixtures/*.json', { import: 'default' });

/** The fixture whose name the uploaded file's name contains (e.g. "Brochure_Bad.zip" -> brochure), else flyer-sales. */
async function sampleCheck(fileName: string): Promise<unknown> {
  const name = fileName.toLowerCase().replace(/[_\s]/g, '-');
  const path =
    Object.keys(FIXTURES).find((p) => name.includes(p.replace(/^.*\/|\.json$/g, ''))) ?? '../fixtures/flyer-sales.json';
  return FIXTURES[path]();
}

/** Answer /v1/checks uploads (sent with XMLHttpRequest for upload progress) from the results fixtures. */
function installUploadMock() {
  class SampleXHR extends XMLHttpRequest {
    private sample = false;

    open(method: string, url: string | URL, ...rest: [boolean?, string?, string?]) {
      const href = String(url);
      this.sample = href.startsWith(`${baseURL}/v1/checks`) && !href.includes('/v1/checks/');
      if (rest.length) super.open(method, url, rest[0] ?? true, rest[1], rest[2]);
      else super.open(method, url);
    }

    send(body?: Document | XMLHttpRequestBodyInit | null) {
      if (!this.sample) return super.send(body);
      const file = body instanceof FormData ? body.get('file') : null;
      void sampleCheck(file instanceof File ? file.name : '').then(async (response) => {
        await new Promise((resolve) => setTimeout(resolve, 600));
        Object.defineProperty(this, 'status', { value: 200 });
        Object.defineProperty(this, 'response', { value: JSON.stringify({ run_id: 'sample', status: 'completed', ...(response as object) }) });
        this.upload.dispatchEvent(new ProgressEvent('load'));
        this.dispatchEvent(new ProgressEvent('load'));
      });
    }
  }
  window.XMLHttpRequest = SampleXHR;
}

export function renderWithSampleData(root: Root) {
  installFetchMock();
  installUploadMock();
  console.info('[sample data] Analytics and summary feedback are answered from src/dev/sampleData.ts, checks from src/fixtures');
  root.render(
    <React.StrictMode>
      <AuthContext.Provider value={auth}>
        <App />
      </AuthContext.Provider>
    </React.StrictMode>
  );
}
