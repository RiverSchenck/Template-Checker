import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, Copy, KeyRound, Plus, Trash2 } from 'lucide-react';
import { baseURL, getAuthHeaders } from '../Analytics/api';
import { useAuth } from '../AuthContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
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
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';

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
  { days: 180, label: '180 days' },
  { days: 365, label: '1 year' },
];

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function statusBadge(k: ApiKey) {
  if (k.revoked_at) return <Badge variant="outline" className="font-normal text-muted-foreground">Revoked</Badge>;
  if (!k.active) return <Badge variant="outline" className="font-normal text-muted-foreground">Expired</Badge>;
  return <Badge variant="secondary" className="font-normal">Active</Badge>;
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
      setCreateError('Give the key a name so you can recognize it later.');
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

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col p-6">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <KeyRound className="h-6 w-6 text-muted-foreground" />
              API keys
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Use a key to run the checker from scripts or other tools. Keys act as you and only work on the
              check endpoints. Treat them like passwords.
            </p>
          </div>
          <Button onClick={openCreate} className="shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            Create key
          </Button>
        </div>

        <Card className="mb-6">
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-3 p-6">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : keys.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                You don’t have any API keys yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Key</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Last used</TableHead>
                      <TableHead className="w-[52px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keys.map((k) => (
                      <TableRow key={k.id} className={k.active ? undefined : 'opacity-60'}>
                        <TableCell className="font-medium">{k.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{k.key_prefix}…</TableCell>
                        <TableCell>{statusBadge(k)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(k.created_at)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(k.expires_at)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {k.last_used_at ? formatDate(k.last_used_at) : 'Never'}
                        </TableCell>
                        <TableCell>
                          {k.active && (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Revoke ${k.name}`}
                              onClick={() => setRevokeTarget(k)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="rounded-lg border p-4 text-sm">
          <p className="mb-2 font-medium">Example</p>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
{`curl -H "Authorization: Bearer tc_..." \\
  -F "file=@package.zip" \\
  ${baseURL}/run`}
          </pre>
          <p className="mt-2 text-muted-foreground">
            Use <code className="font-mono">/run-and-download-xml</code> instead to get the ZIP output.
          </p>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={closeCreate}>
        <DialogContent className="sm:max-w-md">
          {newKey ? (
            <>
              <DialogHeader>
                <DialogTitle>Copy your new key</DialogTitle>
                <DialogDescription>
                  This is the only time the key is shown. Store it somewhere safe, like a secrets manager.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2 py-2">
                <Input readOnly value={newKey} className="h-10 font-mono text-xs" onFocus={(e) => e.target.select()} />
                <Button type="button" variant="outline" size="icon" onClick={handleCopy} aria-label="Copy key">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <DialogFooter>
                <Button type="button" onClick={() => closeCreate(false)}>Done</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Create API key</DialogTitle>
                <DialogDescription>The key will be able to run checks as you until it expires or you revoke it.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate}>
                <div className="grid gap-4 py-2">
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
                      className="h-10"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="api-key-expiry">Expires after</Label>
                    <Select value={expiryDays} onValueChange={setExpiryDays} disabled={creating}>
                      <SelectTrigger id="api-key-expiry" className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPIRY_OPTIONS.map((o) => (
                          <SelectItem key={o.days} value={String(o.days)}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {createError && <p className="text-sm text-destructive">{createError}</p>}
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button type="button" variant="outline" onClick={() => closeCreate(false)} disabled={creating}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating}>
                    {creating ? 'Creating…' : 'Create key'}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Revoke “{revokeTarget?.name}”?</DialogTitle>
            <DialogDescription>
              Anything using this key will stop working right away. This can’t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRevokeTarget(null)} disabled={revoking}>Cancel</Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={revoking}>
              {revoking ? 'Revoking…' : 'Revoke key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
