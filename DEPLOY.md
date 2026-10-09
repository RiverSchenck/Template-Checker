# Deploying Template Checker to Fly.io

You have two Fly apps:

- **Backend** (`template-checker-test`) → https://template-checker-test.fly.dev
- **Frontend** (`template-checker`) → https://template-checker.fly.dev

Deploy backend first, then frontend (so the frontend can point at the backend URL).

---

## 1. Deploy the backend

```bash
cd python_backend
fly deploy
```

(If you haven’t logged in: `fly auth login`.)

---

## 2. Set backend secrets

These are **required** so the backend can run and talk to Supabase:

| Secret         | What to set                                                                    |
| -------------- | ------------------------------------------------------------------------------ |
| `SUPABASE_URL` | Your Supabase project URL, e.g. `https://xxxxx.supabase.co`                    |
| `SUPABASE_KEY` | Your Supabase **service role** (secret) key from Project Settings → API. **Not** the anon/publishable key—the backend needs the service role to write to `users` and `access_requests` (RLS blocks anon). |

Set them from the backend directory (use your real values):

```bash
cd python_backend
fly secrets set SUPABASE_URL="https://your-project.supabase.co" SUPABASE_KEY="your-service-role-key"
```

**Optional:** Only if your frontend is **not** at `https://template-checker.fly.dev`:

```bash
fly secrets set FRONTEND_URL="https://your-actual-frontend-url.fly.dev"
```

After changing secrets, Fly restarts the app automatically.

The API only accepts signed-in Supabase users who are approved (have a row in `users`). There is no static API token: never add one as a `VITE_*` variable, because everything in `VITE_*` ends up in the public JavaScript bundle.

---

## 3. Deploy the frontend

The frontend is static: all `VITE_*` variables are **baked in at build time**. So the image must be built with the right values.

### Option A: Build with a production `.env` (simplest)

1. In `react-frontend`, create or edit `.env` with your **production** values:

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_API_URL=https://template-checker-test.fly.dev
   ```

   `VITE_API_URL` must be your **backend** URL (`template-checker-test.fly.dev`).

2. Deploy (Docker build will use this `.env`):

   ```bash
   cd react-frontend
   fly deploy
   ```

3. **Do not commit `.env`.** It’s in `.gitignore`. For CI or another machine, use that environment’s way of providing these vars during the build.

### Option B: Build in CI with env from secrets

If you build in GitHub Actions (or similar), store the same vars as repo/organization secrets and pass them as build args or env when running `docker build` / `fly deploy`, so they’re never in the image repo.

---

## 4. Quick checklist

- [ ] Backend: `cd python_backend && fly deploy`
- [ ] Backend: `fly secrets set SUPABASE_URL=... SUPABASE_KEY=...` (from `python_backend`)
- [ ] Frontend: Set `VITE_API_URL=https://template-checker-test.fly.dev` (and other `VITE_*`) in `react-frontend/.env`
- [ ] Frontend: `cd react-frontend && fly deploy`
- [ ] Open https://template-checker.fly.dev and test

---

## Using the API outside the web app

Approved users can create personal API keys from the user menu → **API keys** (requires `python_backend/migrations/005_api_keys.sql`). A key acts as its owner and only works on `POST /run` and `POST /run-and-download-xml`; every other route still needs a browser login.

```bash
curl -H "Authorization: Bearer tc_..." -F "file=@package.zip" https://template-checker-test.fly.dev/run
```

- The key is shown once at creation; only a SHA-256 hash is stored.
- Keys expire (30 days to 1 year, default 90) and can be revoked at any time. Each user can have up to 10 active keys.
- Removing a user deletes their keys. Admins can list and revoke anyone's keys via `GET`/`DELETE /admin/api-keys`.
- Runs made with a key are recorded in analytics as source `api` and attributed to the key's owner.

---

## Useful commands

```bash
# List secrets (values are hidden)
fly secrets list

# Backend logs
fly logs -a template-checker-test

# Frontend logs
fly logs -a template-checker

# SSH into backend app
fly ssh console -a template-checker-test
```

---

## Troubleshooting

- **GET /me returns 403**: Normal for new users. They’re not in the `users` table yet. They should submit an access request; an admin approves them, then they can sign in again.
- **POST /access-requests returns 500**: Backend needs the Supabase **service role** key (not the anon key). In Supabase: Project Settings → API → `service_role` (secret). Set it with `fly secrets set SUPABASE_KEY="eyJ..."`. Then redeploy or let Fly restart.
- Ensure the `users` and `access_requests` tables exist in Supabase (run `python_backend/migrations/001_users_and_access_requests.sql` if needed). Bootstrap the first admin: `INSERT INTO users (email, role) VALUES ('your@email.com', 'admin');`
