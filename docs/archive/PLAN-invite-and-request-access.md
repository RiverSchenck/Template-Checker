# Detailed Plan: Single `users` Table + Invite & Request Access

This plan replaces the current access model (Supabase Auth domain restriction + `profiles` + unused `allowed_users`) with:

- **One `users` table** in Supabase: approved users, their role, and cached Google name/picture.
- **`access_requests` table**: people who requested access but are not yet approved.
- No use of `profiles` or `allowed_users` for access/role; Google name/picture come from Auth and are synced into `users` on sign-in.

---

## 1. Database schema

### 1.1 New table: `users`

Single source of truth for “who can sign in” and “what is their role.” Optional cached display name and avatar from Google.

| Column          | Type      | Description |
|-----------------|-----------|-------------|
| `id`            | uuid      | Primary key, `DEFAULT gen_random_uuid()`. Used in admin API (PATCH/DELETE). |
| `email`         | text      | UNIQUE NOT NULL, lowercase. Used to match on sign-in (JWT email). |
| `role`          | text      | NOT NULL DEFAULT 'user', CHECK (role IN ('user', 'admin')). |
| `display_name`  | text      | Nullable. Synced from Auth `user_metadata` on sign-in. |
| `avatar_url`    | text      | Nullable. Synced from Auth `user_metadata` (e.g. `picture`) on sign-in. |
| `auth_user_id`  | uuid      | Nullable, FK → auth.users(id) ON DELETE SET NULL. Set when user first signs in; null for “invited but not yet signed in.” |
| `created_at`    | timestamptz | DEFAULT now(). |
| `updated_at`    | timestamptz | DEFAULT now(), updated on role/display/avatar change. |

- **Allowed to sign in:** user has a row in `users` (matched by `email` from JWT).
- **Is admin:** `users.role = 'admin'`.
- **Google name/picture:** Stored in Supabase Auth (`user_metadata`). Synced into `users.display_name` and `users.avatar_url` on `/me` so the app can read from one place (e.g. admin list, header).

**SQL:**

```sql
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    display_name TEXT,
    avatar_url TEXT,
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_users_email ON users(LOWER(email));
CREATE INDEX idx_users_auth_user_id ON users(auth_user_id);
```

### 1.2 New table: `access_requests`

Stores “requested access” before approval. When approved, a row is added to `users` and the request is marked approved.

| Column       | Type        | Description |
|-------------|-------------|-------------|
| `id`        | uuid        | Primary key, DEFAULT gen_random_uuid(). |
| `email`     | text        | NOT NULL. |
| `status`    | text        | NOT NULL, CHECK (status IN ('pending', 'approved', 'rejected')). |
| `created_at`| timestamptz | DEFAULT now(). |
| `updated_at`| timestamptz | DEFAULT now(), updated when status changes. |
| `decided_by`| uuid        | Nullable, FK → auth.users(id). Admin who approved/rejected. |

**SQL:**

```sql
CREATE TABLE IF NOT EXISTS access_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    decided_by UUID REFERENCES auth.users(id)
);
CREATE INDEX idx_access_requests_status ON access_requests(status);
```

### 1.3 Existing tables

- **`profiles`:** No longer used for access or role. Can be dropped in a later migration or left in place; code will not read or write it for this flow.
- **`allowed_users`:** Replaced by `users`. Can be dropped or left; code will not use it.

### 1.4 Bootstrap first admin

No env-based admin list. Create the first admin by inserting one row:

```sql
INSERT INTO users (email, role) VALUES ('your-email@example.com', 'admin');
```

After that, that user signs in with Google; `/me` will match by email and sync their `display_name`/`avatar_url`. Further admins are created by an existing admin (change role in User Management or via invite with role admin if you add that later).

---

## 2. Backend

### 2.1 New module: `app/users.py` (or refactor `profiles.py` → `users.py`)

Replace profile/allowlist logic with `users`-table helpers.

- **`get_user_by_email(email: str) -> Optional[dict]**  
  Query `users` by LOWER(email). Return row dict or None.

- **`get_user_by_auth_id(auth_user_id: str) -> Optional[dict]**  
  Query `users` by auth_user_id. Return row dict or None.

- **`is_user_allowed(email: str) -> bool**  
  Return True if `get_user_by_email(email)` is not None. (No separate allowlist table.)

- **`is_admin(email: str, auth_user_id: Optional[str] = None) -> bool**  
  Get row by email or auth_user_id; return True if row exists and row['role'] == 'admin'.

- **`upsert_user_on_signin(auth_user_id: str, email: str, display_name: Optional[str], avatar_url: Optional[str]) -> dict**  
  Find `users` row by email. If not found, return None (caller will 403). If found: set `auth_user_id` if currently null, set `display_name`, `avatar_url`, `updated_at`. Return updated row. (Do not create rows here; only invite/approve create rows.)

- **`get_supabase_client()`**  
  Reuse from `analytics_api` or existing helper.

All DB access via Supabase client (service role). No `profiles` or `allowed_users` references.

### 2.2 `/me` (refactor)

**File:** [python_backend/app/routes.py](python_backend/app/routes.py)

- Require valid JWT (existing).
- From JWT: `user_id` = sub, `email` = email claim (lowercase), `user_metadata` = name/picture.
- **Access check:** `user_row = get_user_by_email(email)`. If no row → **403** body:  
  `{"error": {"message": "Access not authorized", "code": "access_denied"}, "allowed": false}`.
- **Sync and respond:** Call `upsert_user_on_signin(auth_user_id=user_id, email=email, display_name=..., avatar_url=...)`. If it returns None (should not if we have a row), 403. Otherwise return **200** with body from that row, e.g.:  
  `{ "id": user_row['id'], "email": user_row['email'], "display_name": user_row['display_name'], "avatar_url": user_row['avatar_url'], "role": user_row['role'] }`.  
  Use the **users** row id (not auth.users id) if the frontend needs a stable id; otherwise you can still expose auth_user_id for compatibility. Prefer exposing fields from `users` so the app has one source of truth.

No call to `profile_helpers` or `profiles`. No `ALLOWED_ADMIN_EMAILS`.

### 2.3 `require_admin` decorator

**File:** [python_backend/app/routes.py](python_backend/app/routes.py)

- After `require_auth`, get `user_id` and `email` from `g.supabase_jwt`.
- Call `users.is_admin(email=email, auth_user_id=user_id)` (using new `users` module). If False → 403 "Admin role required".
- No use of `profile_helpers.is_admin` or `get_allowed_admin_emails`.

### 2.4 Access requests API

**File:** [python_backend/app/routes.py](python_backend/app/routes.py)

- **POST /access-requests** (no auth)  
  - Body: `{ "email": "user@example.com" }`.  
  - Validate email format. Optional: rate limit by IP or email.  
  - Insert into `access_requests` (email, status='pending'). If you want idempotency for same email, use ON CONFLICT or check existing pending.  
  - Return 201 with `{ "id": "<uuid>", "email": "...", "status": "pending" }`.

- **GET /admin/access-requests** (auth + admin)  
  - Query `access_requests` (filter status=pending for main view; optionally all with pagination).  
  - Return JSON array: id, email, status, created_at, updated_at, decided_by.

- **PATCH /admin/access-requests/<request_id>** (auth + admin)  
  - Body: `{ "status": "approved" | "rejected" }`.  
  - Load request by id. If approved: insert into `users` (email from request, role='user'), then set request status and decided_by, updated_at. If rejected: only update request.  
  - Return 200 with updated request.

### 2.5 Invite (admin)

- **POST /admin/invites** (auth + admin)  
  - Body: `{ "email": "user@example.com" }`.  
  - Validate email. Insert into `users` (email=normalized, role='user', auth_user_id=null). If email already in `users`, return 409 or 200 idempotent.  
  - Return 201 with created user row (id, email, role, created_at).

### 2.6 Admin users list

- **GET /admin/users** (auth + admin)  
  - Query **users** table only (no auth.admin.list_users). Return list of: id, email, role, display_name, avatar_url, auth_user_id, created_at, updated_at.  
  - Frontend uses `users.id` for PATCH/DELETE. So admin UI is “list of approved users” from `users`, not “all Auth users.”

### 2.7 Admin PATCH user role

- **PATCH /admin/users/<user_id>** (auth + admin)  
  - `user_id` is **users.id** (UUID from our table), not auth.users id.  
  - Body: `{ "role": "user" | "admin" }`.  
  - Update `users` set role, updated_at where id = user_id. Return 200 with updated row.  
  - Optional: if you store auth_user_id and want to keep JWT in sync, call `supabase.auth.admin.update_user_by_id(auth_user_id, {'app_metadata': {'role': new_role}})`. Not required if frontend always gets role from `/me`/users.

### 2.8 Admin remove user (revoke access)

- **DELETE /admin/users/<user_id>** (auth + admin)  
  - `user_id` is **users.id**.  
  - Prevent deleting self: resolve current user’s `users.id` from email (get_user_by_email), compare with user_id; if same, 403.  
  - Delete from `users` where id = user_id. Return 204.  
  - Do **not** delete from auth.users by default (so they keep their Google account but lose access). Optionally add a separate “delete from Auth” action or query param for full removal later.

### 2.9 Remove old code

- Delete or refactor [python_backend/app/profiles.py](python_backend/app/profiles.py): remove all profile/allowed_admin logic; either remove the file and use `users.py` only, or keep a thin wrapper that delegates to `users.py` for backward compatibility during migration. Prefer single `users.py` and update every `profile_helpers` reference in routes to the new module.
- In routes: remove any `supabase.table('profiles')` and `profile_helpers.*` usage. Remove `ALLOWED_ADMIN_EMAILS` from any logic.

---

## 3. Frontend

### 3.1 AuthContext: 403 from `/me`

**File:** [react-frontend/src/components/AuthContext.tsx](react-frontend/src/components/AuthContext.tsx)

- In the block that calls `fetch(`${baseURL}/me`, ...)`:
  - If `res.status === 403`: parse JSON; if body has `allowed === false` or `code === 'access_denied'`, call `supabase.auth.signOut()` and set role to null. Optionally set a flag (e.g. `accessDenied: true` in context or `sessionStorage`) or navigate to `/?accessDenied=1` so the login page can show “Request access.”
  - Do not treat 403 as “role = user”; treat as “not allowed” and sign out.

### 3.2 Login page: “Request access”

**File:** [react-frontend/src/components/Login/Login.tsx](react-frontend/src/components/Login/Login.tsx)

- Add a “Request access” link/section below “Sign in with Google.”
- When clicked (or when URL has `accessDenied=1` or context has `accessDenied`), show a small form: email input, “Submit request” button.
- On submit: POST `/access-requests` with `{ email }`. Show success: “Request submitted. An admin will review it.” Clear `accessDenied`/param if desired.
- No auth required for this request. Optionally prefill email from URL param if you pass it after 403.

### 3.3 User Management: data model and API

**File:** [react-frontend/src/components/Admin/UserManagement.tsx](react-frontend/src/components/Admin/UserManagement.tsx)

- **List:** GET `/admin/users` returns list from `users` table. Each item has `id` (users.id), `email`, `role`, `display_name`, `avatar_url`, `auth_user_id`, `created_at`. Use `id` for all subsequent PATCH/DELETE (not auth user id).
- **Change role:** PATCH `/admin/users/${user.id}` with `{ role }` (user.id is users.id).
- **Remove user:** DELETE `/admin/users/${user.id}`. Confirm dialog: “Remove access? They will not be able to sign in again.”
- **Invite:** New button “Invite by email.” Dialog with email input; POST `/admin/invites` with `{ email }`. On success, refresh list or add the new row to state (new user will have auth_user_id null until they sign in).
- **Access requests:** New section “Pending access requests.” GET `/admin/access-requests` (filter pending on backend or frontend). Table: email, requested date, actions “Approve” / “Reject.” Approve → PATCH `/admin/access-requests/${request.id}` with `{ status: 'approved' }`; Reject → `{ status: 'rejected' }`. On approve, refresh so the new user appears in the users list after they sign in (or show a toast “They can now sign in”).

### 3.4 ProtectedLayout / current user

- If the app shows current user name/avatar in header or sidebar, use the data returned from `/me` (which now comes from `users` and includes `display_name`, `avatar_url`). No change needed if you already use `/me` response; ensure the type includes optional `avatar_url` and that you use the `id` from `/me` only if needed (e.g. for “current user” comparison with admin list; if backend uses users.id in /me response, frontend can use that).

### 3.5 AuthCallback

**File:** [react-frontend/src/components/AuthCallback.tsx](react-frontend/src/components/AuthCallback.tsx)

- Keep handling OAuth errors (e.g. “email not authorized”) for the transition period. After full cutover, most “not allowed” will be 403 from `/me`; you can simplify copy to “Not authorized. Request access below.” if desired.

---

## 4. Supabase Auth config

- In Supabase Dashboard, remove the restriction that limits sign-in to a single domain (e.g. @frontify.com). Allow any Google user to complete sign-in; access is gated by presence in `users` and 403 from `/me` when not in the table.

---

## 5. Migration and rollout

1. **Create tables:** Run the `users` and `access_requests` SQL in the Template Checker Supabase project.
2. **Bootstrap admin:** Run `INSERT INTO users (email, role) VALUES ('your@email.com', 'admin');`.
3. **Deploy backend:** New `users` module, refactored `/me`, `require_admin`, new access-request and invite endpoints, admin list/PATCH/DELETE using `users` table. Remove or refactor `profiles` usage.
4. **Deploy frontend:** 403 handling, request-access form, User Management changes (list by users, invite, access requests).
5. **Optional data migration:** If you have existing users in `profiles` you want to keep: run a one-off that inserts into `users` from `profiles` (email, role, id → auth_user_id, etc.). Then you can drop `profiles` later.
6. **Optional:** Drop `allowed_users` and `profiles` in a follow-up migration once everything runs on `users`.

---

## 6. Summary: where things live

| Concept                    | Where it lives                          |
|---------------------------|-----------------------------------------|
| Approved users + role     | `users` table (email, role, display_name, avatar_url, auth_user_id) |
| Google name/picture       | Supabase Auth `user_metadata`; synced into `users` on `/me` |
| Requested, not approved   | `access_requests` table (status = 'pending') |
| Is admin?                 | `users.role = 'admin'`                  |
| Can sign in?              | Has row in `users` (matched by email)   |
| First admin               | One-time SQL insert into `users`        |

This gives you a single `users` table for approved users and their role, with Google info synced from Auth into that table, and a clear place for “requested but not approved” in `access_requests`.
