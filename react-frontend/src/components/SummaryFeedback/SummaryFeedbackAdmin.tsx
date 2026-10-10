import React, { useEffect, useMemo, useState } from 'react';
import { Check, MessageSquareText, RotateCcw } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../../lib/utils';
import { notify } from '../../lib/notify';
import {
  EmptyState,
  ErrorState,
  PageHeader,
  PageShell,
  Panel,
  SearchField,
  Segmented,
  StatusDot,
  secondaryActionClass,
} from '../layout/page-kit';
import { fetchAdminFeedback, setCommentResolved, type AdminFeedback, type SummaryComment } from './api';
import {
  groupComments,
  isApproval,
  matchesFilters,
  matchesQuery,
  type StatusFilter,
  type TypeFilter,
} from './feedback';
import { CommentRow, FeedbackSkeleton } from './CommentRow';
import { SummarySnapshotSheet } from './SummarySnapshotSheet';

function Stat({ label, value, dot }: { label: string; value: number | null; dot?: 'green' | 'amber' }) {
  return (
    <div className="flex items-baseline gap-2">
      {dot && (
        <span className="self-center">
          <StatusDot tone={dot} />
        </span>
      )}
      <span className="text-muted-foreground">{label}</span>
      {value == null ? (
        <Skeleton className="h-3.5 w-6 self-center rounded" />
      ) : (
        <span className="font-semibold tabular-nums text-foreground">{value}</span>
      )}
    </div>
  );
}

export function SummaryFeedbackAdmin() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [data, setData] = useState<AdminFeedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [type, setType] = useState<TypeFilter>('all');
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [viewingId, setViewingId] = useState<string | null>(null);
  /** Group order as loaded, so resolving a comment doesn't make its group jump down the page. */
  const [groupOrder, setGroupOrder] = useState<string[]>([]);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const next = await fetchAdminFeedback(token);
      setData(next);
      setGroupOrder(groupComments(next.comments).map((g) => g.id));
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const comments = useMemo(() => data?.comments ?? [], [data]);
  const setResolvedAt = (id: string, resolved_at: string | null) =>
    setData((d) => d && { ...d, comments: d.comments.map((c) => (c.id === id ? { ...c, resolved_at } : c)) });

  const toggleResolved = async (c: SummaryComment) => {
    if (!token || pending.has(c.id)) return;
    const previous = c.resolved_at;
    const resolve = !previous;
    setResolvedAt(c.id, resolve ? new Date().toISOString() : null);
    setPending((p) => new Set(p).add(c.id));
    try {
      const updated = await setCommentResolved(token, c.id, resolve);
      // The PATCH response has no author or review fields, so only take the new timestamp from it.
      setResolvedAt(c.id, updated.resolved_at ?? null);
      // The row leaves the filtered list, so say where it went and let them take it back.
      const leftList = (status === 'open' && resolve) || (status === 'resolved' && !resolve);
      if (leftList && viewingId !== c.id) {
        notify.success(resolve ? 'Comment resolved' : 'Comment reopened', {
          duration: 6000,
          action: { label: 'Undo', onClick: () => toggleResolved({ ...c, resolved_at: updated.resolved_at ?? null }) },
        });
      }
    } catch (e) {
      setResolvedAt(c.id, previous);
      notify.error(e instanceof Error ? e.message : "Couldn't update the comment. Try again.");
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(c.id);
        return next;
      });
    }
  };

  const approvals = comments.filter(isApproval).length;
  const openCount = comments.filter((c) => !c.resolved_at).length;
  const visible = comments.filter((c) => matchesFilters(c, status, type) && matchesQuery(c, query));
  const rank = (id: string) => (groupOrder.includes(id) ? groupOrder.indexOf(id) : groupOrder.length);
  const groups = groupComments(visible).sort((a, b) => rank(a.id) - rank(b.id));
  const filtered = status !== 'all' || type !== 'all' || query.trim() !== '';
  const loadFailed = loadError && !data;
  const viewing = viewingId ? comments.find((c) => c.id === viewingId) ?? null : null;
  const showCounts = !loading && !loadFailed;

  const clearFilters = () => {
    setStatus('all');
    setType('all');
    setQuery('');
  };

  return (
    <PageShell>
      <PageHeader
        icon={MessageSquareText}
        title="Summary feedback"
        description="What support thinks of the customer summary while it’s in beta."
      />

      {!loadFailed && (
        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 px-1 text-sm">
          <Stat label="Reviews" value={showCounts ? data?.stats.reviews ?? 0 : null} />
          <Stat label="Comments" value={showCounts ? comments.length - approvals : null} />
          <Stat label="Approved as-is" value={showCounts ? approvals : null} dot="green" />
          <Stat label="Open" value={showCounts ? openCount : null} dot="amber" />
        </div>
      )}

      <Panel
        toolbar={
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Segmented<StatusFilter>
                ariaLabel="Filter by status"
                value={status}
                onChange={setStatus}
                options={[
                  { value: 'all', label: 'All', count: showCounts ? comments.length : undefined },
                  { value: 'open', label: 'Open', count: showCounts ? openCount : undefined },
                  { value: 'resolved', label: 'Resolved', count: showCounts ? comments.length - openCount : undefined },
                ]}
              />
              <Segmented<TypeFilter>
                ariaLabel="Filter by type"
                value={type}
                onChange={setType}
                options={[
                  { value: 'all', label: 'All types' },
                  { value: 'comments', label: 'Comments' },
                  { value: 'approvals', label: 'Approvals' },
                ]}
              />
            </div>
            <SearchField value={query} onChange={setQuery} placeholder="Search comments, templates or people" />
          </>
        }
        footer={
          showCounts && comments.length > 0 ? (
            <span>
              Showing <span className="font-medium text-foreground">{visible.length}</span> of {comments.length}{' '}
              {comments.length === 1 ? 'comment' : 'comments'}
            </span>
          ) : undefined
        }
      >
        {loading && !data ? (
          <FeedbackSkeleton rows={4} grouped />
        ) : loadFailed ? (
          <ErrorState title="Couldn't load summary feedback" onRetry={load} />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={MessageSquareText}
            title={
              !filtered
                ? 'No feedback yet'
                : status === 'open' && type === 'all' && !query.trim()
                  ? 'No open feedback'
                  : 'No matching feedback'
            }
            description={
              !filtered
                ? 'Comments from the customer summary review show up here.'
                : status === 'open' && type === 'all' && !query.trim()
                  ? 'Everything has been resolved.'
                  : 'Try a different search term or filter.'
            }
            action={
              filtered ? (
                <Button variant="outline" size="sm" className={secondaryActionClass} onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          groups.map((g, i) => (
            <section key={g.id} aria-label={g.title} className={cn(i > 0 && 'border-t')}>
              <div className="flex items-center gap-2 border-b bg-neutral-50/70 px-4 py-2 text-xs dark:bg-neutral-900/40 sm:px-5">
                <h2 className="min-w-0 truncate text-[13px] font-semibold text-foreground">{g.title}</h2>
                <span className="shrink-0 tabular-nums text-muted-foreground">{g.comments.length}</span>
                {g.openCount > 0 && (
                  <span className="ml-auto flex shrink-0 items-center gap-1.5 text-muted-foreground">
                    <StatusDot tone="amber" />
                    <span className="tabular-nums">{g.openCount} open</span>
                  </span>
                )}
              </div>
              <ul className="divide-y">
                {g.comments.map((c) => (
                  <CommentRow
                    key={c.id}
                    comment={c}
                    onView={(x) => setViewingId(x.id)}
                    admin={{ onToggleResolved: toggleResolved, pending: pending.has(c.id) }}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </Panel>

      <SummarySnapshotSheet
        comment={viewing}
        onClose={() => setViewingId(null)}
        showAuthor
        footer={
          viewing && (
            <Button
              variant="outline"
              size="sm"
              className={cn(secondaryActionClass, 'h-8 px-3 text-xs')}
              disabled={pending.has(viewing.id)}
              onClick={() => toggleResolved(viewing)}
            >
              {viewing.resolved_at ? <RotateCcw className="h-3.5 w-3.5" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}
              {viewing.resolved_at ? 'Reopen' : 'Resolve'}
            </Button>
          )
        }
      />
    </PageShell>
  );
}
