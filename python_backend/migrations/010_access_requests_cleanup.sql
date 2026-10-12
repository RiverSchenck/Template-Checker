-- Migration: access requests record who decided as users.id, and allow one pending request per email.
-- Run in the Template Checker Supabase project (SQL Editor) BEFORE deploying the backend that writes
-- users.id into access_requests.decided_by; until then, approving or rejecting a request would fail.
-- Safe to run more than once.

BEGIN;

-- 1. decided_by pointed at auth.users (the Supabase login id) while users.approved_by points at users.id.
--    Make both use users.id. Drop whatever foreign key decided_by has, convert the values, then re-add it.
DO $$
DECLARE c text;
BEGIN
    FOR c IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
        WHERE con.conrelid = 'public.access_requests'::regclass
          AND con.contype = 'f'
          AND att.attname = 'decided_by'
    LOOP
        EXECUTE format('ALTER TABLE public.access_requests DROP CONSTRAINT %I', c);
    END LOOP;
END $$;

-- Values that are a user's login id become their users.id.
UPDATE public.access_requests ar
SET decided_by = u.id
FROM public.users u
WHERE ar.decided_by = u.auth_user_id
  AND ar.decided_by IS DISTINCT FROM u.id;

-- Anything that still isn't a users.id (e.g. the admin was removed since) can't be resolved.
UPDATE public.access_requests
SET decided_by = NULL
WHERE decided_by IS NOT NULL
  AND decided_by NOT IN (SELECT id FROM public.users);

ALTER TABLE public.access_requests
    ADD CONSTRAINT access_requests_decided_by_fkey
    FOREIGN KEY (decided_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- 2. One pending request per email. Keep the oldest pending request for each email; drop the repeats.
DELETE FROM public.access_requests a
USING public.access_requests b
WHERE a.status = 'pending'
  AND b.status = 'pending'
  AND lower(a.email) = lower(b.email)
  AND (a.created_at, a.id) > (b.created_at, b.id);

CREATE UNIQUE INDEX IF NOT EXISTS access_requests_one_pending_per_email
    ON public.access_requests (lower(email))
    WHERE status = 'pending';

COMMIT;
