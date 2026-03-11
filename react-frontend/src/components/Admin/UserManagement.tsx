import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { Trash2, User, UserPlus, Users, Inbox, Mail, Shield, ShieldCheck, ArrowDown, ArrowUpDown, Filter, XCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { cn } from '../../lib/utils';

export interface AdminUser {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url?: string | null;
  auth_user_id?: string | null;
  role: 'user' | 'admin';
  created_at: string | null;
  updated_at?: string | null;
  last_seen_at?: string | null;
}

export interface AccessRequest {
  id: string;
  email: string;
  status: string;
  why_need_access?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  created_at: string | null;
  updated_at?: string | null;
  decided_by?: string | null;
}

type AccessRequestSortKey = 'email' | 'name' | 'requested';
type UserSortKey = 'email' | 'display_name' | 'role' | 'joined' | 'last_seen';
type SortDir = 'asc' | 'desc';

function SortableHead({
  label,
  sortKey,
  currentSortKey,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  sortKey: AccessRequestSortKey | UserSortKey;
  currentSortKey: AccessRequestSortKey | UserSortKey | null;
  sortDir: SortDir;
  onSort: (key: AccessRequestSortKey | UserSortKey) => void;
  className?: string;
}) {
  const isActive = currentSortKey === sortKey;
  return (
    <TableHead className={cn('text-muted-foreground', className)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="flex w-full items-center gap-1.5 rounded-sm px-1 py-0.5 text-left text-sm font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {label}
        {isActive ? (
          <ArrowDown
            className={cn('h-3.5 w-3.5 shrink-0', sortDir === 'desc' && 'rotate-180')}
            aria-hidden
          />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
        )}
      </button>
    </TableHead>
  );
}

export function UserManagement() {
  const { session, currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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
  const [updatingAction, setUpdatingAction] = useState<'approved' | 'rejected' | null>(null);
  const [accessRequestSortKey, setAccessRequestSortKey] = useState<AccessRequestSortKey | null>(null);
  const [accessRequestSortDir, setAccessRequestSortDir] = useState<SortDir>('asc');
  const [accessRequestStatusFilter, setAccessRequestStatusFilter] = useState<'pending' | 'rejected'>('pending');
  const [confirmApproveRejected, setConfirmApproveRejected] = useState<AccessRequest | null>(null);
  const [userSortKey, setUserSortKey] = useState<UserSortKey | null>(null);
  const [userSortDir, setUserSortDir] = useState<SortDir>('asc');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin'>('all');

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
      const res = await fetch(`${baseURL}/admin/access-requests?status=${accessRequestStatusFilter}`, {
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
  }, [token, accessRequestStatusFilter]);

  const isAccessRequestsView = location.hash === '#access-requests';

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

  const handleAccessRequestDecision = async (requestId: string, status: 'approved' | 'rejected'): Promise<boolean> => {
    if (!token) return false;
    setUpdatingRequestId(requestId);
    setUpdatingAction(status);
    try {
      const res = await fetch(`${baseURL}/admin/access-requests/${requestId}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        toast.error(status === 'approved' ? 'Failed to approve' : 'Failed to reject');
        return false;
      }
      setAccessRequests((prev) => prev.filter((r) => r.id !== requestId));
      if (status === 'approved') {
        fetchUsers();
        toast.success('Access approved. They can now sign in.');
      } else {
        toast.success('Request rejected.');
      }
      return true;
    } catch {
      toast.error('Request failed');
      return false;
    } finally {
      setUpdatingRequestId(null);
      setUpdatingAction(null);
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

  const formatDateRelative = (iso: string | null) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      return d.toLocaleDateString();
    } catch {
      return null;
    }
  };

  /** Format date and time for display (e.g. "Today at 2:30 PM", "Yesterday at 3:05 PM", "Mar 8, 2025, 10:00 AM"). */
  const formatDateTimeDisplay = (iso: string | null) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      const now = new Date();
      // Use calendar-day boundaries (local midnight) so "Yesterday" means the previous calendar day
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
      const t = d.getTime();
      const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      if (t >= startOfToday) return `Today at ${timeStr}`;
      if (t >= startOfYesterday) return `Yesterday at ${timeStr}`;
      const daysAgo = Math.floor((startOfToday - t) / (24 * 60 * 60 * 1000));
      if (daysAgo < 7) return `${daysAgo} days ago at ${timeStr}`;
      return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return iso;
    }
  };

  const handleAccessRequestSort = (key: AccessRequestSortKey) => {
    if (accessRequestSortKey === key) {
      setAccessRequestSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setAccessRequestSortKey(key);
      setAccessRequestSortDir('asc');
    }
  };

  const handleUserSort = (key: UserSortKey) => {
    if (userSortKey === key) {
      setUserSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setUserSortKey(key);
      setUserSortDir('asc');
    }
  };

  const sortedAccessRequests = useMemo(() => {
    if (!accessRequestSortKey) return accessRequests;
    return [...accessRequests].sort((a, b) => {
      let cmp = 0;
      switch (accessRequestSortKey) {
        case 'email':
          cmp = (a.email ?? '').toLowerCase().localeCompare((b.email ?? '').toLowerCase());
          break;
        case 'name':
          cmp = (a.display_name ?? '').toLowerCase().localeCompare((b.display_name ?? '').toLowerCase());
          break;
        case 'requested': {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          cmp = aTime - bTime;
          break;
        }
        default:
          return 0;
      }
      return accessRequestSortDir === 'asc' ? cmp : -cmp;
    });
  }, [accessRequests, accessRequestSortKey, accessRequestSortDir]);

  const filteredAndSortedUsers = useMemo(() => {
    let list = users;
    if (roleFilter !== 'all') {
      list = list.filter((u) => u.role === roleFilter);
    }
    if (!userSortKey) return list;
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (userSortKey) {
        case 'email':
          cmp = (a.email ?? '').toLowerCase().localeCompare((b.email ?? '').toLowerCase());
          break;
        case 'display_name':
          cmp = (a.display_name ?? '').toLowerCase().localeCompare((b.display_name ?? '').toLowerCase());
          break;
        case 'role':
          cmp = (a.role ?? '').localeCompare(b.role ?? '');
          break;
        case 'joined': {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          cmp = aTime - bTime;
          break;
        }
        case 'last_seen': {
          const aTime = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0;
          const bTime = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0;
          cmp = aTime - bTime;
          break;
        }
        default:
          return 0;
      }
      return userSortDir === 'asc' ? cmp : -cmp;
    });
  }, [users, roleFilter, userSortKey, userSortDir]);

  if (loading && location.hash !== '#access-requests') {
    return (
      <div className="flex min-w-0 flex-1 flex-col p-6">
        <div className="mx-auto w-full max-w-5xl min-w-[min(100%,64rem)] overflow-hidden">
        <div className="mb-8">
          <Skeleton className="mb-2 h-8 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="mb-8">
          <Skeleton className="mb-4 h-6 w-48" />
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]" />
                    <TableHead>Email</TableHead>
                    <TableHead>Display name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-9 w-[100px]" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
        </div>
      </div>
    );
  }
  if (loadingRequests && location.hash === '#access-requests') {
    return (
      <div className="flex min-w-0 flex-1 flex-col p-6">
        <div className="mx-auto w-full max-w-5xl min-w-[min(100%,64rem)] overflow-hidden">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Inbox className="h-6 w-6 text-muted-foreground" />
              Access requests
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Approve or reject people waiting to join. Invite by email to add someone directly.
            </p>
          </div>
          <Button
            onClick={() => { setInviteOpen(true); setInviteError(null); setInviteEmail(''); }}
            className="shrink-0"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Invite by email
          </Button>
        </div>
        <Card className="mb-8">
          <CardHeader className="pb-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="mt-1 h-4 w-64" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="border-t px-6 py-8">
              <Skeleton className="h-20 w-full rounded-md" />
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex min-w-0 flex-1 flex-col p-6">
        <div className="mx-auto w-full max-w-5xl min-w-[min(100%,64rem)] overflow-hidden">
        {/* Page header: same on both views, with Invite by email */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              {isAccessRequestsView ? (
                <>
                  <Inbox className="h-6 w-6 text-muted-foreground" />
                  Access requests
                </>
              ) : (
                <>
                  <Users className="h-6 w-6 text-muted-foreground" />
                  Users
                </>
              )}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAccessRequestsView
                ? 'Approve or reject people waiting to join. Invite by email to add someone directly.'
                : 'Invite users and manage roles.'}
            </p>
          </div>
          <Button
            onClick={() => { setInviteOpen(true); setInviteError(null); setInviteEmail(''); }}
            className="shrink-0"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Invite by email
          </Button>
        </div>

        {/* Access requests view: Pending and Rejected tabs */}
        {isAccessRequestsView && (
        <Card id="access-requests" className="mb-8 scroll-mt-6">
          <CardHeader className="p-0 pb-0">
            <Tabs value={accessRequestStatusFilter} onValueChange={(v) => setAccessRequestStatusFilter(v as 'pending' | 'rejected')}>
              {/* Underline-style tab bar: primary navigation for the card */}
              <div className="flex flex-col border-b border-border px-6 pt-4">
                <TabsList className="min-h-10 w-full justify-start gap-0 rounded-none border-0 bg-transparent p-0 pb-0 shadow-none">
                  <TabsTrigger
                    value="pending"
                    className="gap-2 rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-0 text-sm font-medium text-muted-foreground shadow-none outline-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    Pending
                    {!loadingRequests && accessRequestStatusFilter === 'pending' && accessRequests.length > 0 && (
                      <Badge variant="secondary" className="h-5 min-w-5 px-1.5 font-normal tabular-nums">
                        {accessRequests.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger
                    value="rejected"
                    className="gap-2 rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-0 text-sm font-medium text-muted-foreground shadow-none outline-none transition-colors ltr:ml-6 rtl:mr-6 hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    Rejected
                    {!loadingRequests && accessRequestStatusFilter === 'rejected' && accessRequests.length > 0 && (
                      <Badge variant="secondary" className="h-5 min-w-5 px-1.5 font-normal tabular-nums">
                        {accessRequests.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
                <p className="pb-4 text-sm text-muted-foreground">
                  {accessRequestStatusFilter === 'pending'
                    ? 'Approve or reject people waiting to join.'
                    : 'Previously rejected requests. You can approve them to grant access.'}
                </p>
              </div>
            </Tabs>
          </CardHeader>
          <CardContent className="w-full min-w-0 p-0">
            {loadingRequests ? (
              <div className="w-full min-w-0 px-6 py-8">
                <Skeleton className="h-20 w-full rounded-md" />
              </div>
            ) : accessRequests.length === 0 ? (
              <div className="flex w-full min-w-0 flex-col items-center justify-center px-6 py-14 text-center">
                <div className="rounded-full bg-muted/60 p-4">
                  <Inbox className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="mt-4 text-sm font-medium text-foreground">
                  {accessRequestStatusFilter === 'pending' ? 'No pending requests' : 'No rejected requests'}
                </p>
                <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
                  {accessRequestStatusFilter === 'pending'
                    ? "When someone requests access, they'll appear here for you to approve or reject."
                    : 'Requests you reject will appear here. You can approve them later to grant access.'}
                </p>
              </div>
            ) : (
              <Table className="table-fixed w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[52px] pr-0" />
                    <SortableHead
                      label="Email"
                      sortKey="email"
                      currentSortKey={accessRequestSortKey}
                      sortDir={accessRequestSortDir}
                      onSort={handleAccessRequestSort}
                      className="w-[200px] min-w-[180px]"
                    />
                    <SortableHead
                      label="Name"
                      sortKey="name"
                      currentSortKey={accessRequestSortKey}
                      sortDir={accessRequestSortDir}
                      onSort={handleAccessRequestSort}
                      className="w-[140px] min-w-[120px]"
                    />
                    <SortableHead
                      label="Requested"
                      sortKey="requested"
                      currentSortKey={accessRequestSortKey}
                      sortDir={accessRequestSortDir}
                      onSort={handleAccessRequestSort}
                      className="w-[120px]"
                    />
                    <TableHead className="min-w-[180px]">Why they need access</TableHead>
                    <TableHead className="w-[200px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedAccessRequests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="w-[52px] py-3 pr-0">
                        <Avatar className="h-8 w-8">
                          {r.avatar_url ? (
                            <AvatarImage src={r.avatar_url} alt="" />
                          ) : null}
                          <AvatarFallback className="bg-muted text-xs">
                            {(r.display_name || r.email || '?').charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="py-3 font-medium">{r.email}</TableCell>
                      <TableCell className="py-3 text-muted-foreground text-sm">
                        {r.display_name ?? '—'}
                      </TableCell>
                      <TableCell className="py-3 text-muted-foreground text-sm">
                        <span title={formatDate(r.created_at)}>
                          {formatDateTimeDisplay(r.created_at)}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-muted-foreground text-sm max-w-[280px]">
                        {r.why_need_access ? (
                          <span className="line-clamp-2" title={r.why_need_access}>
                            {r.why_need_access}
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="default"
                                className="min-w-[88px] text-xs bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-sm"
                                disabled={updatingRequestId === r.id}
                                onClick={() =>
                                  accessRequestStatusFilter === 'rejected'
                                    ? setConfirmApproveRejected(r)
                                    : handleAccessRequestDecision(r.id, 'approved')
                                }
                              >
                                {updatingRequestId === r.id && updatingAction === 'approved' ? (
                                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
                                ) : (
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                )}
                                {updatingRequestId === r.id && updatingAction === 'approved' ? 'Updating…' : 'Approve'}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              {accessRequestStatusFilter === 'rejected'
                                ? 'Grant access (opens confirmation)'
                                : 'Grant this user access'}
                            </TooltipContent>
                          </Tooltip>
                          {accessRequestStatusFilter === 'pending' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="min-w-[88px] text-xs border-input text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
                                disabled={updatingRequestId === r.id}
                                onClick={() => handleAccessRequestDecision(r.id, 'rejected')}
                              >
                                {updatingRequestId === r.id && updatingAction === 'rejected' ? (
                                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5" />
                                )}
                                {updatingRequestId === r.id && updatingAction === 'rejected' ? 'Updating…' : 'Reject'}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left">Decline this request</TooltipContent>
                          </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        )}

        {/* Users view: only the Approved users table */}
        {!isAccessRequestsView && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg font-medium">Approved users</CardTitle>
              <CardDescription>
                {roleFilter === 'all'
                  ? `${users.length} ${users.length === 1 ? 'user' : 'users'} with access.`
                  : `${filteredAndSortedUsers.length} ${filteredAndSortedUsers.length === 1 ? 'user' : 'users'}.`}{' '}
                Change roles or remove access.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[52px] pr-0" />
                  <SortableHead
                    label="Email"
                    sortKey="email"
                    currentSortKey={userSortKey}
                    sortDir={userSortDir}
                    onSort={handleUserSort}
                  />
                  <SortableHead
                    label="Display name"
                    sortKey="display_name"
                    currentSortKey={userSortKey}
                    sortDir={userSortDir}
                    onSort={handleUserSort}
                  />
                  <TableHead className="w-[200px] min-w-[200px] whitespace-nowrap text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleUserSort('role')}
                        className="flex cursor-pointer select-none items-center gap-1.5 rounded-sm py-0.5 text-left text-sm font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        Role
                        {userSortKey === 'role' ? (
                          <ArrowDown
                            className={cn('h-3.5 w-3.5 shrink-0', userSortDir === 'desc' && 'rotate-180')}
                            aria-hidden
                          />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
                        )}
                      </button>
                      <span className="h-4 w-px shrink-0 bg-border" aria-hidden />
                      <Select
                        value={roleFilter}
                        onValueChange={(v) => setRoleFilter(v as 'all' | 'user' | 'admin')}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <SelectTrigger
                              className={cn(
                                'h-8 w-9 shrink-0 border-dashed px-0 font-normal',
                                roleFilter === 'all'
                                  ? 'text-muted-foreground hover:text-foreground'
                                  : 'border-primary/30 bg-primary/5 text-foreground'
                              )}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={
                                roleFilter === 'all'
                                  ? 'Filter by role'
                                  : roleFilter === 'user'
                                    ? 'Showing users only'
                                    : 'Showing admins only'
                              }
                            >
                              <span className="flex flex-1 items-center justify-center pl-1 [&:not(:only-child)]:mr-0">
                                {roleFilter === 'all' && <Filter className="h-4 w-4" />}
                                {roleFilter === 'user' && <User className="h-4 w-4" />}
                                {roleFilter === 'admin' && <Shield className="h-4 w-4" />}
                              </span>
                            </SelectTrigger>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="font-normal">
                            {roleFilter === 'all' && 'Filter by role'}
                            {roleFilter === 'user' && 'Showing users only'}
                            {roleFilter === 'admin' && 'Showing admins only'}
                          </TooltipContent>
                        </Tooltip>
                        <SelectContent>
                          <SelectItem value="all">
                            <span className="flex items-center gap-2">
                              <Filter className="h-4 w-4 text-muted-foreground" />
                              All roles
                            </span>
                          </SelectItem>
                          <SelectItem value="user">
                            <span className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              User
                            </span>
                          </SelectItem>
                          <SelectItem value="admin">
                            <span className="flex items-center gap-2">
                              <Shield className="h-4 w-4 text-muted-foreground" />
                              Admin
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TableHead>
                  <SortableHead
                    label="Joined"
                    sortKey="joined"
                    currentSortKey={userSortKey}
                    sortDir={userSortDir}
                    onSort={handleUserSort}
                  />
                  <SortableHead
                    label="Last seen"
                    sortKey="last_seen"
                    currentSortKey={userSortKey}
                    sortDir={userSortDir}
                    onSort={handleUserSort}
                    className="w-[120px]"
                  />
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48">
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="rounded-full bg-muted/60 p-4">
                          <Users className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="mt-4 text-sm font-medium text-foreground">
                          {roleFilter !== 'all' ? 'No users with this role' : 'No users yet'}
                        </p>
                        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
                          Invite someone by email to give them access. They’ll sign in with Google.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-5"
                          onClick={() => {
                            if (roleFilter !== 'all') setRoleFilter('all');
                            else {
                              setInviteOpen(true);
                              setInviteError(null);
                              setInviteEmail('');
                            }
                          }}
                        >
                          <Mail className="mr-2 h-4 w-4" />
                          {roleFilter !== 'all' ? 'Show all roles' : 'Invite by email'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedUsers.map((u) => {
                    const isCurrentUser = currentUserEmail != null && u.email === currentUserEmail;
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="w-[52px] py-3 pr-0">
                          <Avatar className="h-8 w-8">
                            {u.avatar_url ? (
                              <AvatarImage src={u.avatar_url} alt="" />
                            ) : null}
                            <AvatarFallback className="bg-muted text-xs">
                              {(u.display_name || u.email || '?').charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </TableCell>
                        <TableCell className="py-3 font-medium">
                          <div className="flex min-w-0 flex-nowrap items-center gap-2">
                            <span className="min-w-0 truncate">{u.email ?? '—'}</span>
                            {isCurrentUser && (
                              <Badge variant="secondary" className="shrink-0 text-xs font-normal">
                                You
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-muted-foreground text-sm">
                          {u.display_name ?? '—'}
                        </TableCell>
                        <TableCell className="py-3">
                          <Select
                            value={u.role}
                            onValueChange={(value) =>
                              handleRoleChange(u.id, value as 'user' | 'admin')
                            }
                          >
                            <SelectTrigger className="h-8 w-[120px] border-dashed">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">
                                <span className="flex items-center gap-1.5">
                                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                                  User
                                </span>
                              </SelectItem>
                              <SelectItem value="admin">
                                <span className="flex items-center gap-1.5">
                                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                                  Admin
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="py-3 text-muted-foreground text-sm">
                          <span title={formatDate(u.created_at)}>
                            {formatDateRelative(u.created_at) ?? formatDate(u.created_at)}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 text-muted-foreground text-sm">
                          {u.last_seen_at ? (
                            <span title={formatDate(u.last_seen_at)}>
                              {formatDateTimeDisplay(u.last_seen_at)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="py-3">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                  disabled={isCurrentUser}
                                  onClick={() => setDeleteTarget(u)}
                                  aria-label={isCurrentUser ? 'You cannot remove yourself' : 'Remove access'}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {isCurrentUser ? 'You cannot remove yourself' : 'Remove access'}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        )}

        </div>
        {/* Remove user dialog */}
        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Remove user</DialogTitle>
              <DialogDescription asChild>
                <div>
                  <p>
                    This user will lose access and won’t be able to sign in again. This action cannot be undone.
                  </p>
                  {deleteTarget && (
                    <p className="mt-3 rounded-md bg-muted px-3 py-2 font-medium text-foreground">
                      {deleteTarget.email ?? deleteTarget.display_name ?? deleteTarget.id}
                    </p>
                  )}
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
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

        {/* Confirm approve previously rejected request */}
        <Dialog open={!!confirmApproveRejected} onOpenChange={(open) => !open && setConfirmApproveRejected(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Approve previously rejected request?</DialogTitle>
              <DialogDescription asChild>
                <div>
                  <p>
                    This request was previously rejected. Approving will grant them access and they will be able to sign in.
                  </p>
                  {confirmApproveRejected && (
                    <p className="mt-3 rounded-md bg-muted px-3 py-2 font-medium text-foreground">
                      {confirmApproveRejected.email}
                    </p>
                  )}
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setConfirmApproveRejected(null)}
                disabled={updatingRequestId === confirmApproveRejected?.id}
              >
                Cancel
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                onClick={async () => {
                  if (!confirmApproveRejected) return;
                  const ok = await handleAccessRequestDecision(confirmApproveRejected.id, 'approved');
                  if (ok) setConfirmApproveRejected(null);
                }}
                disabled={updatingRequestId === confirmApproveRejected?.id}
              >
                {updatingRequestId === confirmApproveRejected?.id && updatingAction === 'approved'
                  ? 'Approving…'
                  : 'Approve access'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Invite dialog */}
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Invite by email
              </DialogTitle>
              <DialogDescription>
                Add an email to the allowed list. They’ll receive no automated email—they can sign in with Google once added.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleInvite}>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="invite-email">Email address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="colleague@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    disabled={inviteSubmitting}
                    autoFocus
                    autoComplete="email"
                    className="h-10"
                  />
                  {inviteError && (
                    <p className="text-sm text-destructive">{inviteError}</p>
                  )}
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setInviteOpen(false)}
                  disabled={inviteSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={inviteSubmitting}>
                  {inviteSubmitting ? 'Sending…' : 'Send invite'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
