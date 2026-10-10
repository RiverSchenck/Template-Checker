import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpDown,
  Ban,
  Check,
  Inbox,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Shield,
  ShieldCheck,
  Trash2,
  User,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { baseURL, getAuthHeaders } from '../Analytics/api';
import { useAuth } from '../AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '../../lib/utils';
import {
  DAY_MS,
  DialogIcon,
  DialogSubject,
  EmptyState,
  Notice,
  PageHeader,
  PageShell,
  Panel,
  PersonAvatar,
  PersonCell,
  RowSkeleton,
  SearchField,
  Segmented,
  Spinner,
  StatusDot,
  StatusPill,
  approveActionClass,
  formatAbsolute,
  formatRelative,
  formatRelativeInline,
  isWithin,
  primaryActionClass,
  secondaryActionClass,
} from '../layout/page-kit';

export interface AdminUser {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url?: string | null;
  auth_user_id?: string | null;
  role: 'user' | 'admin';
  /** Set on insert: admin email invite vs approved access request. Omitted/null for legacy rows. */
  added_via?: 'invite' | 'access_request' | null;
  /** `users.id` of the admin who invited or approved this row; resolve against the user list for display. */
  approved_by?: string | null;
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

type RequestStatus = 'pending' | 'rejected';
type RequestSort = 'newest' | 'oldest' | 'name' | 'email';
type UserSortKey = 'name' | 'role' | 'joined' | 'last_seen';
type SortDir = 'asc' | 'desc';
type RoleFilter = 'all' | 'admin' | 'user';

const USER_GRID = 'sm:grid-cols-[minmax(0,1fr)_8.5rem_6.5rem_8rem_2.25rem]';

function addedViaLabel(v: AdminUser['added_via']): string {
  if (v === 'invite') return 'Email invite';
  if (v === 'access_request') return 'Access request';
  return 'Unknown';
}

function buildApproverLabelLookup(allUsers: AdminUser[]): (approverId: string | null | undefined) => string {
  const byId = new Map<string, AdminUser>();
  for (const row of allUsers) {
    byId.set(row.id, row);
  }
  return (approverId) => {
    if (!approverId) return '—';
    const approver = byId.get(approverId);
    if (!approver) return 'Unknown admin';
    const name = approver.display_name?.trim();
    if (name) return name;
    if (approver.email) return approver.email;
    return 'Unknown admin';
  };
}

function matches(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => f?.toLowerCase().includes(q));
}

function time(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1 text-[13px]">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  current,
  dir,
  onSort,
}: {
  label: string;
  sortKey: UserSortKey;
  current: UserSortKey | null;
  dir: SortDir;
  onSort: (k: UserSortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={cn(
        'group inline-flex items-center gap-1 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {label}
      {active ? (
        <ArrowDown className={cn('h-3 w-3 transition-transform', dir === 'desc' && 'rotate-180')} aria-hidden />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" aria-hidden />
      )}
    </button>
  );
}

function RoleSelect({ value, onChange }: { value: AdminUser['role']; onChange: (r: AdminUser['role']) => void }) {
  const isAdmin = value === 'admin';
  return (
    <Select value={value} onValueChange={(v) => onChange(v as AdminUser['role'])}>
      <SelectTrigger
        className={cn(
          'h-7 w-auto justify-start gap-1.5 rounded-full border-0 px-2.5 text-xs font-medium shadow-none ring-1 ring-inset focus:ring-2 focus:ring-offset-0 [&>svg:last-child]:h-3 [&>svg:last-child]:w-3',
          isAdmin
            ? 'bg-violet-50 text-violet-700 ring-violet-200 hover:bg-violet-100 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/30'
            : 'bg-neutral-100 text-neutral-700 ring-neutral-200 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-700'
        )}
        aria-label="Change role"
      >
        {isAdmin ? <ShieldCheck className="h-3.5 w-3.5 shrink-0" /> : <User className="h-3.5 w-3.5 shrink-0" />}
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start">
        <SelectItem value="user">User</SelectItem>
        <SelectItem value="admin">Admin</SelectItem>
      </SelectContent>
    </Select>
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
  const [requests, setRequests] = useState<Record<RequestStatus, AccessRequest[]>>({ pending: [], rejected: [] });
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
  const [updatingAction, setUpdatingAction] = useState<'approved' | 'rejected' | null>(null);
  const [requestStatus, setRequestStatus] = useState<RequestStatus>('pending');
  const [requestSort, setRequestSort] = useState<RequestSort>('newest');
  const [confirmApproveRejected, setConfirmApproveRejected] = useState<AccessRequest | null>(null);
  const [userSortKey, setUserSortKey] = useState<UserSortKey | null>(null);
  const [userSortDir, setUserSortDir] = useState<SortDir>('asc');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [query, setQuery] = useState('');

  const token = session?.access_token;
  const currentUserEmail = currentUser?.email ?? null;
  const isAccessRequestsView = location.hash === '#access-requests';

  useEffect(() => {
    setQuery('');
  }, [isAccessRequestsView]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchRequestList = async (status: RequestStatus): Promise<AccessRequest[] | null> => {
    if (!token) return null;
    try {
      const res = await fetch(`${baseURL}/admin/access-requests?status=${status}`, {
        headers: getAuthHeaders(token),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return null;
    }
  };

  const fetchAccessRequests = async () => {
    if (!token) return;
    setLoadingRequests(true);
    const [pending, rejected] = await Promise.all([fetchRequestList('pending'), fetchRequestList('rejected')]);
    setRequests((prev) => ({ pending: pending ?? prev.pending, rejected: rejected ?? prev.rejected }));
    setLoadingRequests(false);
  };

  useEffect(() => {
    fetchAccessRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const openInvite = () => {
    setInviteOpen(true);
    setInviteError(null);
    setInviteEmail('');
  };

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
      toast.success(`${email} can now sign in with Google.`);
    } catch {
      setInviteError('Failed to invite.');
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleAccessRequestDecision = async (request: AccessRequest, status: 'approved' | 'rejected'): Promise<boolean> => {
    if (!token) return false;
    setUpdatingRequestId(request.id);
    setUpdatingAction(status);
    try {
      const res = await fetch(`${baseURL}/admin/access-requests/${request.id}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        toast.error(status === 'approved' ? 'Failed to approve' : 'Failed to reject');
        return false;
      }
      setRequests((prev) => ({
        pending: prev.pending.filter((r) => r.id !== request.id),
        rejected:
          status === 'rejected'
            ? [{ ...request, status: 'rejected' }, ...prev.rejected]
            : prev.rejected.filter((r) => r.id !== request.id),
      }));
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
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
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

  const handleUserSort = (key: UserSortKey) => {
    if (userSortKey === key) {
      setUserSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setUserSortKey(key);
      setUserSortDir(key === 'joined' || key === 'last_seen' ? 'desc' : 'asc');
    }
  };

  const visibleRequests = useMemo(() => {
    const list = requests[requestStatus].filter((r) => matches(query, r.email, r.display_name, r.why_need_access));
    return [...list].sort((a, b) => {
      switch (requestSort) {
        case 'oldest':
          return time(a.created_at) - time(b.created_at);
        case 'name':
          return (a.display_name || a.email).toLowerCase().localeCompare((b.display_name || b.email).toLowerCase());
        case 'email':
          return a.email.toLowerCase().localeCompare(b.email.toLowerCase());
        default:
          return time(b.created_at) - time(a.created_at);
      }
    });
  }, [requests, requestStatus, requestSort, query]);

  const visibleUsers = useMemo(() => {
    let list = users.filter((u) => matches(query, u.email, u.display_name));
    if (roleFilter !== 'all') list = list.filter((u) => u.role === roleFilter);
    if (!userSortKey) return list;
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (userSortKey) {
        case 'name':
          cmp = (a.display_name || a.email || '').toLowerCase().localeCompare((b.display_name || b.email || '').toLowerCase());
          break;
        case 'role':
          cmp = (a.role ?? '').localeCompare(b.role ?? '');
          break;
        case 'joined':
          cmp = time(a.created_at) - time(b.created_at);
          break;
        case 'last_seen':
          cmp = time(a.last_seen_at) - time(b.last_seen_at);
          break;
      }
      return userSortDir === 'asc' ? cmp : -cmp;
    });
  }, [users, roleFilter, userSortKey, userSortDir, query]);

  const approverLabel = useMemo(() => buildApproverLabelLookup(users), [users]);
  const adminCount = useMemo(() => users.filter((u) => u.role === 'admin').length, [users]);
  const pendingCount = requests.pending.length;

  const inviteButton = (
    <Button onClick={openInvite} className={primaryActionClass}>
      <UserPlus className="h-4 w-4" />
      Invite by email
    </Button>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <PageShell>
        {isAccessRequestsView ? (
          <>
            <PageHeader
              icon={Inbox}
              title="Access requests"
              description="Review requests to join from the sign-in page, or invite someone directly by email."
              actions={inviteButton}
            />

            <Panel
              toolbar={
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Segmented<RequestStatus>
                      ariaLabel="Request status"
                      value={requestStatus}
                      onChange={setRequestStatus}
                      options={[
                        { value: 'pending', label: 'Pending', count: loadingRequests ? undefined : pendingCount },
                        { value: 'rejected', label: 'Rejected', count: loadingRequests ? undefined : requests.rejected.length },
                      ]}
                    />
                    <Select value={requestSort} onValueChange={(v) => setRequestSort(v as RequestSort)}>
                      <SelectTrigger className="h-9 w-[9.5rem] rounded-lg text-xs shadow-sm" aria-label="Sort requests">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest first</SelectItem>
                        <SelectItem value="oldest">Oldest first</SelectItem>
                        <SelectItem value="name">Name A–Z</SelectItem>
                        <SelectItem value="email">Email A–Z</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <SearchField value={query} onChange={setQuery} placeholder="Search requests" />
                </>
              }
            >
              {loadingRequests ? (
                <RowSkeleton rows={3} />
              ) : visibleRequests.length === 0 ? (
                query ? (
                  <EmptyState
                    icon={Inbox}
                    title="No matching requests"
                    description={`No ${requestStatus} requests match “${query.trim()}”.`}
                    action={
                      <Button variant="outline" size="sm" className={secondaryActionClass} onClick={() => setQuery('')}>
                        Clear search
                      </Button>
                    }
                  />
                ) : requestStatus === 'pending' ? (
                  <EmptyState
                    icon={Inbox}
                    title="No pending requests"
                    description="New access requests from the sign-in page will appear here."
                  />
                ) : (
                  <EmptyState
                    icon={Ban}
                    title="No rejected requests"
                    description="Rejected requests are kept here and can be approved later."
                  />
                )
              ) : (
                <ul className="divide-y">
                  {visibleRequests.map((r) => {
                    const busy = updatingRequestId === r.id;
                    const isRejected = requestStatus === 'rejected';
                    return (
                      <li
                        key={r.id}
                        className="flex flex-col gap-4 px-4 py-4 transition-colors hover:bg-neutral-50/70 dark:hover:bg-neutral-900/40 sm:flex-row sm:items-start sm:gap-6 sm:px-5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <PersonCell name={r.display_name} email={r.email} src={r.avatar_url} />
                            {isRejected ? (
                              <StatusPill tone="red">Rejected</StatusPill>
                            ) : (
                              <StatusPill tone="amber" pulse>
                                Pending
                              </StatusPill>
                            )}
                            <span className="text-xs text-muted-foreground" title={formatAbsolute(r.created_at)}>
                              {formatRelative(r.created_at)}
                            </span>
                          </div>
                          {r.why_need_access ? (
                            <div className="ml-12 mt-3 max-w-2xl rounded-lg border bg-muted/50 px-3 py-2.5">
                              <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                                <MessageSquare className="h-3 w-3" aria-hidden />
                                Reason for access
                              </p>
                              <p
                                className="line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-foreground"
                                title={r.why_need_access}
                              >
                                {r.why_need_access}
                              </p>
                            </div>
                          ) : (
                            <p className="ml-12 mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <MessageSquare className="h-3 w-3" aria-hidden />
                              No reason provided
                            </p>
                          )}
                        </div>
                        <div className="ml-12 flex shrink-0 items-center gap-2 sm:ml-0 sm:pt-1">
                          {!isRejected && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={cn(
                                    secondaryActionClass,
                                    'h-8 px-3 text-xs hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:hover:border-rose-500/30 dark:hover:bg-rose-500/10 dark:hover:text-rose-400'
                                  )}
                                  disabled={busy}
                                  onClick={() => handleAccessRequestDecision(r, 'rejected')}
                                >
                                  {busy && updatingAction === 'rejected' ? <Spinner /> : <X className="h-3.5 w-3.5" />}
                                  Reject
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Decline this request</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                className={cn(approveActionClass, 'h-8 px-3 text-xs')}
                                disabled={busy}
                                onClick={() =>
                                  isRejected ? setConfirmApproveRejected(r) : handleAccessRequestDecision(r, 'approved')
                                }
                              >
                                {busy && updatingAction === 'approved' ? <Spinner /> : <Check className="h-3.5 w-3.5" />}
                                Approve
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{isRejected ? 'Grant access (requires confirmation)' : 'Grant access'}</TooltipContent>
                          </Tooltip>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </>
        ) : (
          <>
            <PageHeader
              icon={Users}
              title="Users"
              description="Manage who can sign in to Template Checker and what they can do."
              actions={inviteButton}
            />

            {!loadingRequests && pendingCount > 0 && (
              <Notice
                icon={Inbox}
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 rounded-lg px-2.5 text-xs font-medium"
                    onClick={() => navigate('/admin/users#access-requests')}
                  >
                    Review
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                }
              >
                <span className="font-medium">
                  {pendingCount} access {pendingCount === 1 ? 'request' : 'requests'}
                </span>{' '}
                <span className="text-muted-foreground">{pendingCount === 1 ? 'is' : 'are'} waiting for review.</span>
              </Notice>
            )}

            <Panel
              toolbar={
                <>
                  <Segmented<RoleFilter>
                    ariaLabel="Filter by role"
                    value={roleFilter}
                    onChange={setRoleFilter}
                    options={[
                      { value: 'all', label: 'All', count: loading ? undefined : users.length },
                      { value: 'admin', label: 'Admins', count: loading ? undefined : adminCount },
                      { value: 'user', label: 'Users', count: loading ? undefined : users.length - adminCount },
                    ]}
                  />
                  <SearchField value={query} onChange={setQuery} placeholder="Search by name or email" />
                </>
              }
              footer={
                !loading && users.length > 0 ? (
                  <span>
                    Showing <span className="font-medium text-foreground">{visibleUsers.length}</span> of {users.length}{' '}
                    {users.length === 1 ? 'user' : 'users'}
                  </span>
                ) : undefined
              }
            >
              <div className={cn('hidden items-center gap-4 border-b px-5 py-2.5 sm:grid', USER_GRID)}>
                <SortHeader label="User" sortKey="name" current={userSortKey} dir={userSortDir} onSort={handleUserSort} />
                <SortHeader label="Role" sortKey="role" current={userSortKey} dir={userSortDir} onSort={handleUserSort} />
                <SortHeader label="Joined" sortKey="joined" current={userSortKey} dir={userSortDir} onSort={handleUserSort} />
                <SortHeader label="Last seen" sortKey="last_seen" current={userSortKey} dir={userSortDir} onSort={handleUserSort} />
                <span />
              </div>

              {loading ? (
                <RowSkeleton rows={5} />
              ) : visibleUsers.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title={query || roleFilter !== 'all' ? 'No matching users' : 'No users yet'}
                  description={
                    query || roleFilter !== 'all'
                      ? 'Try a different search term or role filter.'
                      : 'Invite someone by email to give them access. They sign in with Google.'
                  }
                  action={
                    query || roleFilter !== 'all' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className={secondaryActionClass}
                        onClick={() => {
                          setQuery('');
                          setRoleFilter('all');
                        }}
                      >
                        Clear filters
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className={secondaryActionClass} onClick={openInvite}>
                        <Mail className="h-4 w-4" />
                        Invite by email
                      </Button>
                    )
                  }
                />
              ) : (
                <ul className="divide-y">
                  {visibleUsers.map((u) => {
                    const isCurrentUser = currentUserEmail != null && u.email === currentUserEmail;
                    const onlineRecently = isWithin(u.last_seen_at, 15 * 60 * 1000);
                    const activeToday = isWithin(u.last_seen_at, DAY_MS);
                    return (
                      <li
                        key={u.id}
                        className={cn(
                          'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-neutral-50/70 dark:hover:bg-neutral-900/40 sm:px-5',
                          USER_GRID
                        )}
                      >
                        <PersonCell
                          name={u.display_name}
                          email={u.email}
                          src={u.avatar_url}
                          badge={
                            isCurrentUser ? (
                              <span className="shrink-0 rounded-md bg-neutral-900 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-white dark:bg-white dark:text-neutral-900">
                                You
                              </span>
                            ) : null
                          }
                        />

                        <div className="col-start-1 row-start-2 flex items-center gap-3 pl-12 sm:col-start-auto sm:row-start-auto sm:block sm:pl-0">
                          <RoleSelect value={u.role} onChange={(role) => handleRoleChange(u.id, role)} />
                          <span className="text-xs text-muted-foreground sm:hidden">
                            {u.last_seen_at ? `Seen ${formatRelativeInline(u.last_seen_at)}` : 'Never signed in'}
                          </span>
                        </div>

                        <span className="hidden text-sm text-muted-foreground sm:block" title={formatAbsolute(u.created_at)}>
                          {formatRelative(u.created_at)}
                        </span>

                        <span className="hidden items-center gap-2 text-sm sm:flex" title={formatAbsolute(u.last_seen_at)}>
                          {u.last_seen_at ? (
                            <>
                              <StatusDot tone={activeToday ? 'green' : 'neutral'} pulse={onlineRecently} />
                              <span className={activeToday ? 'text-foreground' : 'text-muted-foreground'}>
                                {formatRelative(u.last_seen_at)}
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">Never</span>
                          )}
                        </span>

                        <div className="col-start-2 row-span-2 row-start-1 flex justify-end sm:col-start-auto sm:row-span-1 sm:row-start-auto">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-neutral-100 data-[state=open]:bg-neutral-100 dark:hover:bg-neutral-800 dark:data-[state=open]:bg-neutral-800"
                                aria-label={`More options for ${u.email ?? 'user'}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" sideOffset={6} className="w-[19rem] overflow-hidden rounded-xl p-0 shadow-xl">
                              <div className="relative overflow-hidden px-4 pb-4 pt-5">
                                <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-br from-neutral-100 via-neutral-50 to-transparent dark:from-neutral-800 dark:via-neutral-900" />
                                <div className="relative flex items-center gap-3">
                                  <PersonAvatar name={u.display_name} email={u.email} src={u.avatar_url} size="lg" />
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold">{u.display_name?.trim() || u.email || 'User'}</p>
                                    {u.display_name?.trim() && u.email && (
                                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="relative mt-3 flex flex-wrap gap-1.5">
                                  <StatusPill tone={u.role === 'admin' ? 'violet' : 'neutral'} icon={u.role === 'admin' ? Shield : User}>
                                    {u.role === 'admin' ? 'Admin' : 'User'}
                                  </StatusPill>
                                  <StatusPill tone={activeToday ? 'green' : 'neutral'}>
                                    {activeToday ? 'Active today' : u.last_seen_at ? 'Inactive' : 'Never signed in'}
                                  </StatusPill>
                                </div>
                              </div>
                              <div className="border-t px-4 py-2.5">
                                <DetailRow label="Added via" value={addedViaLabel(u.added_via)} />
                                <DetailRow label="Added by" value={approverLabel(u.approved_by)} />
                                <DetailRow label="Joined" value={formatAbsolute(u.created_at)} />
                                <DetailRow label="Last seen" value={u.last_seen_at ? formatAbsolute(u.last_seen_at) : 'Never'} />
                              </div>
                              <DropdownMenuSeparator className="my-0" />
                              <div className="p-1.5">
                                <DropdownMenuItem
                                  disabled={isCurrentUser}
                                  onSelect={() => {
                                    if (!isCurrentUser) setDeleteTarget(u);
                                  }}
                                  className="cursor-pointer gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium text-rose-600 focus:bg-rose-50 focus:text-rose-700 data-[disabled]:cursor-not-allowed dark:text-rose-400 dark:focus:bg-rose-500/10"
                                >
                                  <UserMinus className="h-4 w-4" aria-hidden />
                                  {isCurrentUser ? 'You can’t remove yourself' : 'Remove access'}
                                </DropdownMenuItem>
                              </div>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </>
        )}
      </PageShell>

      {/* Remove user dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="rounded-2xl outline-none sm:max-w-md">
          <DialogHeader className="space-y-2">
            <DialogIcon icon={Trash2} tone="red" />
            <DialogTitle>Remove user</DialogTitle>
            <DialogDescription>
              This user will lose access immediately and won’t be able to sign in unless they’re invited again.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <DialogSubject>
              <PersonCell name={deleteTarget.display_name} email={deleteTarget.email} src={deleteTarget.avatar_url} />
            </DialogSubject>
          )}
          <DialogFooter className="mt-2 gap-2 sm:gap-0">
            <Button variant="outline" className={secondaryActionClass} onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" className="rounded-lg" onClick={handleDeleteConfirm} disabled={deleting}>
              {deleting && <Spinner />}
              {deleting ? 'Removing…' : 'Remove user'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm approve previously rejected request */}
      <Dialog open={!!confirmApproveRejected} onOpenChange={(open) => !open && setConfirmApproveRejected(null)}>
        <DialogContent className="rounded-2xl outline-none sm:max-w-md">
          <DialogHeader className="space-y-2">
            <DialogIcon icon={UserCheck} tone="green" />
            <DialogTitle>Approve rejected request</DialogTitle>
            <DialogDescription>
              This request was previously rejected. Approving it grants access, and they’ll be able to sign in with Google.
            </DialogDescription>
          </DialogHeader>
          {confirmApproveRejected && (
            <DialogSubject>
              <PersonCell
                name={confirmApproveRejected.display_name}
                email={confirmApproveRejected.email}
                src={confirmApproveRejected.avatar_url}
              />
            </DialogSubject>
          )}
          <DialogFooter className="mt-2 gap-2 sm:gap-0">
            <Button
              variant="outline"
              className={secondaryActionClass}
              onClick={() => setConfirmApproveRejected(null)}
              disabled={updatingRequestId === confirmApproveRejected?.id}
            >
              Cancel
            </Button>
            <Button
              className={approveActionClass}
              onClick={async () => {
                if (!confirmApproveRejected) return;
                const ok = await handleAccessRequestDecision(confirmApproveRejected, 'approved');
                if (ok) setConfirmApproveRejected(null);
              }}
              disabled={updatingRequestId === confirmApproveRejected?.id}
            >
              {updatingRequestId === confirmApproveRejected?.id && updatingAction === 'approved' && <Spinner />}
              {updatingRequestId === confirmApproveRejected?.id && updatingAction === 'approved' ? 'Approving…' : 'Approve access'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="rounded-2xl outline-none sm:max-w-md">
          <DialogHeader className="space-y-2">
            <DialogIcon icon={Mail} tone="blue" />
            <DialogTitle>Invite by email</DialogTitle>
            <DialogDescription>
              Adds the address to the allow list. No email is sent; they can sign in with Google once added.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite}>
            <div className="grid gap-2 py-3">
              <Label htmlFor="invite-email">Email address</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="name@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={inviteSubmitting}
                  autoFocus
                  autoComplete="email"
                  className="h-10 rounded-lg pl-9"
                />
              </div>
              {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
            </div>
            <DialogFooter className="mt-2 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                className={secondaryActionClass}
                onClick={() => setInviteOpen(false)}
                disabled={inviteSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" className={primaryActionClass} disabled={inviteSubmitting || !inviteEmail.includes('@')}>
                {inviteSubmitting && <Spinner />}
                {inviteSubmitting ? 'Adding…' : 'Add user'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
