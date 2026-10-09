import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Check, CheckCircle2, Clock, Copy, KeyRound, Lock, Plus, Terminal, Trash2 } from 'lucide-react';
import { baseURL, getAuthHeaders } from '../Analytics/api';
import { useAuth } from '../AuthContext';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../../lib/utils';
import {
  DAY_MS,
  DialogIcon,
  DialogSubject,
  EmptyState,
  PageHeader,
  PageShell,
  Panel,
  RowSkeleton,
  Segmented,
  Spinner,
  StatusPill,
  formatAbsolute,
  formatRelative,
  formatRelativeInline,
  formatShortDate,
  primaryActionClass,
  secondaryActionClass,
} from '../layout/page-kit';

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string | null;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  active: boolean;
}

const EXPIRY_OPTIONS = [
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 180, label: '6 months' },
  { days: 365, label: '1 year' },
];

/** Keys expiring within this window get flagged. */
const EXPIRING_SOON_DAYS = 14;

type KeyFilter = 'active' | 'all';

const EXAMPLES = {
  run: {
    label: 'JSON report',
    path: '/run',
    note: 'Returns the validation report as JSON.',
  },
  xml: {
    label: 'ZIP output',
    path: '/run-and-download-xml',
    note: 'Returns a ZIP archive containing the generated XML output.',
  },
} as const;

type ExampleKey = keyof typeof EXAMPLES;

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : Math.ceil((t - Date.now()) / DAY_MS);
}

function keyState(k: ApiKey): 'revoked' | 'expired' | 'expiring' | 'active' {
  if (k.revoked_at) return 'revoked';
  if (!k.active) return 'expired';
  const d = daysUntil(k.expires_at);
  if (d != null && d <= EXPIRING_SOON_DAYS) return 'expiring';
  return 'active';
}

function StatusFor({ k }: { k: ApiKey }) {
  switch (keyState(k)) {
    case 'revoked':
      return <StatusPill tone="red">Revoked</StatusPill>;
    case 'expired':
      return <StatusPill tone="neutral">Expired</StatusPill>;
    case 'expiring':
      return (
        <StatusPill tone="amber" pulse>
          Expiring soon
        </StatusPill>
      );
    default:
      return <StatusPill tone="green">Active</StatusPill>;
  }
}

/** Thin bar showing how much of the key's lifetime remains. */
function LifetimeBar({ k }: { k: ApiKey }) {
  const state = keyState(k);
  const start = k.created_at ? new Date(k.created_at).getTime() : NaN;
  const end = k.expires_at ? new Date(k.expires_at).getTime() : NaN;
  const days = daysUntil(k.expires_at);

  if (state === 'revoked') {
    return <span className="text-xs text-muted-foreground">Revoked {formatRelativeInline(k.revoked_at)}</span>;
  }
  if (Number.isNaN(end)) return <span className="text-xs text-muted-foreground">No expiry</span>;

  const pct = Number.isNaN(start) || end <= start ? 100 : Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100));
  const label =
    state === 'expired'
      ? `Expired ${formatShortDate(k.expires_at)}`
      : days === 0
        ? 'Expires today'
        : `${days} ${days === 1 ? 'day' : 'days'} left`;

  return (
    <div className="w-full min-w-0" title={`Expires ${formatAbsolute(k.expires_at)}`}>
      <span
        className={cn('text-xs', state === 'expiring' ? 'font-medium text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}
      >
        {label}
      </span>
      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-700',
            state === 'expired' ? 'bg-neutral-300 dark:bg-neutral-600' : state === 'expiring' ? 'bg-amber-500' : 'bg-emerald-500'
          )}
          style={{ width: `${state === 'expired' ? 100 : Math.max(3, 100 - pct)}%` }}
        />
      </div>
    </div>
  );
}

function CopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          toast.error('Could not copy. Select the text and copy it manually.');
        }
      }}
      className={cn('inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors', className)}
      aria-label="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return data?.error?.message || fallback;
  } catch {
    return fallback;
  }
}

export function ApiKeys() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<KeyFilter>('active');
  const [example, setExample] = useState<ExampleKey>('run');

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [expiryDays, setExpiryDays] = useState('90');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  /** Plaintext key from the create response; shown once, then discarded. */
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [revoking, setRevoking] = useState(false);

  const fetchKeys = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${baseURL}/api-keys`, { headers: getAuthHeaders(token) });
      if (!res.ok) {
        toast.error('Failed to load API keys');
        return;
      }
      const data = await res.json();
      setKeys(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const openCreate = () => {
    setName('');
    setExpiryDays('90');
    setCreateError(null);
    setNewKey(null);
    setCopied(false);
    setCreateOpen(true);
  };

  const closeCreate = (open: boolean) => {
    if (open) return;
    setCreateOpen(false);
    setNewKey(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!name.trim()) {
      setCreateError('Enter a name so you can identify this key later.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch(`${baseURL}/api-keys`, {
        method: 'POST',
        headers: { ...getAuthHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), expires_in_days: Number(expiryDays) }),
      });
      if (!res.ok) {
        setCreateError(await errorMessage(res, 'Failed to create API key'));
        return;
      }
      const data = await res.json();
      setNewKey(data.key);
      fetchKeys();
    } catch {
      setCreateError('Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
    } catch {
      toast.error('Could not copy. Select the key and copy it manually.');
    }
  };

  const handleRevoke = async () => {
    if (!token || !revokeTarget) return;
    setRevoking(true);
    try {
      const res = await fetch(`${baseURL}/api-keys/${revokeTarget.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token),
      });
      if (!res.ok) {
        toast.error(await errorMessage(res, 'Failed to revoke API key'));
        return;
      }
      toast.success(`Revoked “${revokeTarget.name}”`);
      setRevokeTarget(null);
      fetchKeys();
    } catch {
      toast.error('Failed to revoke API key');
    } finally {
      setRevoking(false);
    }
  };

  const activeCount = keys.filter((k) => k.active).length;
  const visibleKeys = filter === 'active' ? keys.filter((k) => k.active) : keys;
  const expiryDate = new Date(Date.now() + Number(expiryDays) * DAY_MS);
  const exampleCode = `curl -X POST ${baseURL}${EXAMPLES[example].path} \\
  -H "Authorization: Bearer tc_…" \\
  -F "file=@package.zip"`;

  return (
    <TooltipProvider delayDuration={200}>
      <PageShell>
        <PageHeader
          icon={KeyRound}
          eyebrow="Developer"
          title="API keys"
          description="Use API keys to run the checker from scripts and CI pipelines. Keys act on your behalf and can only access the check endpoints."
          actions={
            <Button onClick={openCreate} className={primaryActionClass}>
              <Plus className="h-4 w-4" />
              Create key
            </Button>
          }
        />

        <Panel
          className="mb-6"
          toolbar={
            <>
              <Segmented<KeyFilter>
                ariaLabel="Filter keys"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'active', label: 'Active', count: loading ? undefined : activeCount },
                  { value: 'all', label: 'All keys', count: loading ? undefined : keys.length },
                ]}
              />
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5" />
                Treat keys like passwords. Each key is shown only once.
              </p>
            </>
          }
        >
          {loading ? (
            <RowSkeleton rows={2} />
          ) : visibleKeys.length === 0 ? (
            <EmptyState
              icon={KeyRound}
              title={keys.length === 0 ? 'No API keys' : 'No active keys'}
              description={
                keys.length === 0
                  ? 'Create a key to call the checker from a script or CI job.'
                  : 'All of your keys have been revoked or have expired. Create a new key to continue using the API.'
              }
              action={
                <Button size="sm" className={cn(primaryActionClass, 'h-9')} onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Create key
                </Button>
              }
            />
          ) : (
            <>
              <div className="hidden grid-cols-[minmax(0,1fr)_7.5rem_10rem_7rem_2.25rem] items-center gap-4 border-b px-5 py-2.5 text-xs font-medium text-muted-foreground md:grid">
                <span>Key</span>
                <span>Status</span>
                <span>Expires</span>
                <span>Last used</span>
                <span />
              </div>
              <ul className="divide-y">
                {visibleKeys.map((k) => {
                  const inactive = !k.active;
                  return (
                    <li
                      key={k.id}
                      className={cn(
                        'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-4 py-3.5 transition-colors hover:bg-neutral-50/70 dark:hover:bg-neutral-900/40 sm:px-5 md:grid-cols-[minmax(0,1fr)_7.5rem_10rem_7rem_2.25rem]',
                        inactive && 'opacity-60'
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={cn(
                            'grid h-9 w-9 shrink-0 place-items-center rounded-lg border',
                            inactive
                              ? 'bg-neutral-50 text-neutral-400 dark:bg-neutral-900'
                              : 'bg-gradient-to-br from-white to-neutral-100 text-neutral-700 shadow-sm dark:from-neutral-800 dark:to-neutral-900 dark:text-neutral-300'
                          )}
                        >
                          <KeyRound className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{k.name}</p>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                            <code className="rounded bg-neutral-100 px-1.5 py-px font-mono text-[11px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                              {k.key_prefix}••••
                            </code>
                            <span className="hidden sm:inline" title={formatAbsolute(k.created_at)}>
                              Created {formatShortDate(k.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="hidden md:block">
                        <StatusFor k={k} />
                      </div>

                      <div className="col-span-2 row-start-2 flex items-center gap-3 pl-12 md:col-span-1 md:row-start-auto md:block md:pl-0">
                        <span className="md:hidden">
                          <StatusFor k={k} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <LifetimeBar k={k} />
                        </div>
                      </div>

                      <span className="hidden text-sm md:block" title={formatAbsolute(k.last_used_at)}>
                        {k.last_used_at ? formatRelative(k.last_used_at) : <span className="text-muted-foreground">Never</span>}
                      </span>

                      <div className="col-start-2 row-start-1 flex justify-end md:col-start-auto md:row-start-auto">
                        {k.active && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                                aria-label={`Revoke ${k.name}`}
                                onClick={() => setRevokeTarget(k)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Revoke key</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Panel>

        {/* Example request */}
        <section className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 text-neutral-200 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2 text-xs font-medium text-neutral-300">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-white/10">
                <Terminal className="h-3.5 w-3.5" />
              </span>
              Example request
            </span>
            <div className="flex items-center gap-1">
              {(Object.keys(EXAMPLES) as ExampleKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setExample(key)}
                  className={cn(
                    'h-7 rounded-md px-2.5 text-xs font-medium transition-colors',
                    example === key ? 'bg-white/10 text-white' : 'text-neutral-400 hover:text-neutral-200'
                  )}
                >
                  {EXAMPLES[key].label}
                </button>
              ))}
              <span className="mx-1 h-4 w-px bg-white/10" />
              <CopyButton value={exampleCode} className="text-neutral-400 hover:bg-white/10 hover:text-white" />
            </div>
          </div>
          <pre className="overflow-x-auto px-5 py-4 font-mono text-[12.5px] leading-6">
            <code>
              <span className="text-emerald-400">curl</span>
              <span className="text-neutral-400"> -X </span>
              <span className="text-sky-300">POST</span> <span className="text-neutral-100">{baseURL}</span>
              <span className="text-amber-300">{EXAMPLES[example].path}</span>
              <span className="text-neutral-500"> \</span>
              {'\n  '}
              <span className="text-neutral-400">-H </span>
              <span className="text-orange-200">"Authorization: Bearer tc_…"</span>
              <span className="text-neutral-500"> \</span>
              {'\n  '}
              <span className="text-neutral-400">-F </span>
              <span className="text-orange-200">"file=@package.zip"</span>
            </code>
          </pre>
          <p className="border-t border-white/10 px-5 py-2.5 text-xs text-neutral-400">{EXAMPLES[example].note}</p>
        </section>
      </PageShell>

      <Dialog open={createOpen} onOpenChange={closeCreate}>
        <DialogContent className="rounded-2xl outline-none sm:max-w-md">
          {newKey ? (
            <>
              <DialogHeader className="space-y-2">
                <DialogIcon icon={CheckCircle2} tone="green" />
                <DialogTitle>API key created</DialogTitle>
                <DialogDescription>Copy the key now and store it in a secrets manager or another secure location.</DialogDescription>
              </DialogHeader>
              <div className="mt-1 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950">
                <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
                  <span className="truncate text-xs font-medium text-neutral-400">{name.trim() || 'API key'}</span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={cn(
                      'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors',
                      copied ? 'bg-emerald-500/15 text-emerald-400' : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                    )}
                    aria-label="Copy key"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <input
                  readOnly
                  value={newKey}
                  onFocus={(e) => e.target.select()}
                  className="w-full bg-transparent px-3 py-3 font-mono text-[13px] text-emerald-300 outline-none selection:bg-emerald-500/30"
                  aria-label="New API key"
                />
              </div>
              <div className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                <AlertTriangle className="mt-px h-4 w-4 shrink-0" />
                <span>This key won’t be shown again. If you lose it, revoke it and create a new one.</span>
              </div>
              <DialogFooter className="mt-1">
                <Button type="button" className={primaryActionClass} onClick={() => closeCreate(false)}>
                  Done
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader className="space-y-2">
                <DialogIcon icon={KeyRound} />
                <DialogTitle>Create API key</DialogTitle>
                <DialogDescription>The key can run checks on your behalf until it expires or is revoked.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate}>
                <div className="grid gap-5 py-3">
                  <div className="grid gap-2">
                    <Label htmlFor="api-key-name">Name</Label>
                    <Input
                      id="api-key-name"
                      placeholder="e.g. CI pipeline"
                      value={name}
                      maxLength={100}
                      onChange={(e) => setName(e.target.value)}
                      disabled={creating}
                      autoFocus
                      className="h-10 rounded-lg"
                    />
                  </div>
                  <fieldset className="grid gap-2" disabled={creating}>
                    <legend className="mb-2 text-sm font-medium leading-none">Expiration</legend>
                    <div role="radiogroup" className="grid grid-cols-4 gap-2">
                      {EXPIRY_OPTIONS.map((o) => {
                        const selected = expiryDays === String(o.days);
                        return (
                          <button
                            key={o.days}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => setExpiryDays(String(o.days))}
                            className={cn(
                              'rounded-lg border px-2 py-2.5 text-center text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              selected
                                ? 'border-neutral-900 bg-neutral-900 text-white shadow-sm dark:border-white dark:bg-white dark:text-neutral-900'
                                : 'bg-background text-foreground hover:border-neutral-300 hover:bg-neutral-50 dark:hover:border-neutral-700 dark:hover:bg-neutral-900'
                            )}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      Expires on {expiryDate.toLocaleDateString(undefined, { dateStyle: 'long' })}
                    </p>
                  </fieldset>
                  {createError && <p className="text-sm text-destructive">{createError}</p>}
                </div>
                <DialogFooter className="mt-1 gap-2 sm:gap-0">
                  <Button
                    type="button"
                    variant="outline"
                    className={secondaryActionClass}
                    onClick={() => closeCreate(false)}
                    disabled={creating}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className={primaryActionClass} disabled={creating}>
                    {creating && <Spinner />}
                    {creating ? 'Creating…' : 'Create key'}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <DialogContent className="rounded-2xl outline-none sm:max-w-md">
          <DialogHeader className="space-y-2">
            <DialogIcon icon={Trash2} tone="red" />
            <DialogTitle>Revoke API key</DialogTitle>
            <DialogDescription>Any integration using this key will stop working immediately. This can’t be undone.</DialogDescription>
          </DialogHeader>
          {revokeTarget && (
            <DialogSubject>
              <div className="flex items-center gap-3">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <span className="truncate text-sm font-medium">{revokeTarget.name}</span>
                <code className="ml-auto font-mono text-[11px] text-muted-foreground">{revokeTarget.key_prefix}••••</code>
              </div>
            </DialogSubject>
          )}
          <DialogFooter className="mt-2 gap-2 sm:gap-0">
            <Button variant="outline" className={secondaryActionClass} onClick={() => setRevokeTarget(null)} disabled={revoking}>
              Cancel
            </Button>
            <Button variant="destructive" className="rounded-lg" onClick={handleRevoke} disabled={revoking}>
              {revoking && <Spinner />}
              {revoking ? 'Revoking…' : 'Revoke key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
