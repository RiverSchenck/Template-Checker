import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { baseURL, getAuthHeaders } from '../Analytics/api';
import { useAuth } from '../AuthContext';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
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
import { Trash2, UserPlus } from 'lucide-react';

export interface AdminUser {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url?: string | null;
  auth_user_id?: string | null;
  role: 'user' | 'admin';
  created_at: string | null;
  updated_at?: string | null;
}

export interface AccessRequest {
  id: string;
  email: string;
  status: string;
  display_name?: string | null;
  avatar_url?: string | null;
  created_at: string | null;
  updated_at?: string | null;
  decided_by?: string | null;
}

export function UserManagement() {
  const { session, currentUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);

  const token = session?.access_token;
  const currentUserEmail = currentUser?.email ?? null;

  const fetchUsers = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${baseURL}/admin/users`, {
        headers: getAuthHeaders(token),
      });
      if (res.status === 403) {
        navigate('/', { replace: true });
        return;
      }
      if (!res.ok) {
        toast.error('Failed to load users');
        return;
      }
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const fetchAccessRequests = async () => {
    if (!token) return;
    setLoadingRequests(true);
    try {
      const res = await fetch(`${baseURL}/admin/access-requests?status=pending`, {
        headers: getAuthHeaders(token),
      });
      if (res.status === 403) return;
      if (!res.ok) return;
      const data = await res.json();
      setAccessRequests(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    fetchAccessRequests();
  }, [token]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes('@') || !token) return;
    setInviteError(null);
    setInviteSubmitting(true);
    try {
      const res = await fetch(`${baseURL}/admin/invites`, {
        method: 'POST',
        headers: { ...getAuthHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInviteError(data?.error?.message || 'Failed to invite.');
        return;
      }
      setInviteOpen(false);
      setInviteEmail('');
      fetchUsers();
      toast.success('Invite sent. They can sign in with Google.');
    } catch {
      setInviteError('Failed to invite.');
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleAccessRequestDecision = async (requestId: string, status: 'approved' | 'rejected') => {
    if (!token) return;
    setUpdatingRequestId(requestId);
    try {
      const res = await fetch(`${baseURL}/admin/access-requests/${requestId}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        toast.error(status === 'approved' ? 'Failed to approve' : 'Failed to reject');
        return;
      }
      setAccessRequests((prev) => prev.filter((r) => r.id !== requestId));
      if (status === 'approved') {
        fetchUsers();
        toast.success('Access approved. They can now sign in.');
      } else {
        toast.success('Request rejected.');
      }
    } catch {
      toast.error('Request failed');
    } finally {
      setUpdatingRequestId(null);
    }
  };

  const handleRoleChange = async (userId: string, role: 'user' | 'admin') => {
    if (!token) return;
    try {
      const res = await fetch(`${baseURL}/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          ...getAuthHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        toast.error('Failed to update role');
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role } : u))
      );
      toast.success('Role updated');
    } catch {
      toast.error('Failed to update role');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || !token) return;
    setDeleting(true);
    try {
      const res = await fetch(`${baseURL}/admin/users/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token),
      });
      if (res.status === 403) {
        toast.error('You cannot delete this user');
        setDeleteTarget(null);
        return;
      }
      if (!res.ok) {
        toast.error('Failed to delete user');
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success('User removed');
    } catch {
      toast.error('Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  if (loading) {
    return (
      <div className="flex min-w-0 flex-1 flex-col p-6">
        <div className="mb-6">
          <Skeleton className="mb-2 h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Display name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3, 4, 5].map((i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-9 w-[120px]" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">User management</h1>
          <p className="text-muted-foreground text-sm">
            View users, change roles, and remove access.
          </p>
        </div>
        <Button onClick={() => { setInviteOpen(true); setInviteError(null); setInviteEmail(''); }}>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite by email
        </Button>
      </div>

      <div className="mb-8">
        <h2 className="mb-3 text-lg font-medium">Pending access requests</h2>
        {loadingRequests ? (
          <Skeleton className="h-20 w-full rounded-md" />
        ) : accessRequests.length === 0 ? (
          <p className="text-muted-foreground text-sm">No pending requests.</p>
        ) : (
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead className="w-[180px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accessRequests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.email}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {r.display_name ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(r.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          disabled={updatingRequestId === r.id}
                          onClick={() => handleAccessRequestDecision(r.id, 'approved')}
                        >
                          {updatingRequestId === r.id ? '…' : 'Approve'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updatingRequestId === r.id}
                          onClick={() => handleAccessRequestDecision(r.id, 'rejected')}
                        >
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <h2 className="mb-3 text-lg font-medium">Approved users</h2>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Display name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.email ?? '—'}</TableCell>
                  <TableCell>{u.display_name ?? '—'}</TableCell>
                  <TableCell>
                    <Select
                      value={u.role}
                      onValueChange={(value) =>
                        handleRoleChange(u.id, value as 'user' | 'admin')
                      }
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(u.created_at)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={currentUserEmail != null && u.email === currentUserEmail}
                      onClick={() => setDeleteTarget(u)}
                      title={
                        currentUserEmail != null && u.email === currentUserEmail
                          ? 'You cannot remove yourself'
                          : 'Remove access'
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove user</DialogTitle>
            <DialogDescription>
              Remove this user? They will not be able to sign in again.
              {deleteTarget && (
                <span className="mt-2 block font-medium text-foreground">
                  {deleteTarget.email ?? deleteTarget.id}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? 'Removing…' : 'Remove user'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite by email</DialogTitle>
            <DialogDescription>
              Add an email to the allowed list. They can then sign in with Google.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={inviteSubmitting}
                />
                {inviteError && (
                  <p className="text-sm text-destructive">{inviteError}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteOpen(false)}
                disabled={inviteSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={inviteSubmitting}>
                {inviteSubmitting ? 'Sending…' : 'Invite'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
