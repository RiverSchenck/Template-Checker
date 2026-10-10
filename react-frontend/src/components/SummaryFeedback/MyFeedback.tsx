import React, { useEffect, useState } from 'react';
import { MessageSquareText } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { EmptyState, ErrorState, PageHeader, PageShell, Panel } from '../layout/page-kit';
import { fetchMyFeedback, type SummaryComment } from './api';
import { CommentRow, FeedbackSkeleton } from './CommentRow';
import { SummarySnapshotSheet } from './SummarySnapshotSheet';

/** The signed-in agent's own summary comments, newest first, and whether they've been resolved. */
export function MyFeedback() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [comments, setComments] = useState<SummaryComment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [viewing, setViewing] = useState<SummaryComment | null>(null);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      setComments(await fetchMyFeedback(token));
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

  const list = comments ?? [];
  const resolvedCount = list.filter((c) => c.resolved_at).length;

  return (
    <PageShell>
      <PageHeader
        icon={MessageSquareText}
        title="Your feedback"
        description="Your comments on the customer summary, and whether they’ve been picked up."
      />

      <Panel
        footer={
          !loading && list.length > 0 ? (
            <span>
              <span className="font-medium text-foreground">{list.length}</span> {list.length === 1 ? 'comment' : 'comments'}
              {' · '}
              {resolvedCount} resolved
            </span>
          ) : undefined
        }
      >
        {loading && !comments ? (
          <FeedbackSkeleton rows={3} avatar={false} />
        ) : loadError && !comments ? (
          <ErrorState title="Couldn't load your feedback" onRetry={load} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={MessageSquareText}
            title="No feedback yet"
            description="When you review a customer summary, your comments show up here."
          />
        ) : (
          <ul className="divide-y">
            {list.map((c) => (
              <CommentRow key={c.id} comment={c} onView={setViewing} showSection />
            ))}
          </ul>
        )}
      </Panel>

      <SummarySnapshotSheet comment={viewing} onClose={() => setViewing(null)} />
    </PageShell>
  );
}
