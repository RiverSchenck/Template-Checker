import React, { useState } from 'react';
import { ChevronRight, Users } from 'lucide-react';
import { EmptyState, formatAbsolute, formatRelativeInline, PersonAvatar } from '../layout/page-kit';
import { Meter, SectionCard } from './parts';
import { formatCount, personLabel } from './format';
import type { Overview, UserSummary } from './types';

const COLLAPSED_COUNT = 6;

export function Team({ overview, onSelect }: { overview: Overview; onSelect: (user: UserSummary) => void }) {
  const [expanded, setExpanded] = useState(false);
  const users = overview.users;
  const visible = expanded ? users : users.slice(0, COLLAPSED_COUNT);
  const top = Math.max(...users.map((u) => u.runs), 1);

  return (
    <SectionCard
      title="Support team"
      description="Who ran checks in this period. Select someone to see their checks."
      info="Active agents are signed-in users who ran at least one check. Older runs from before attribution show as Unattributed."
      bodyClassName="px-0 pb-2"
    >
      {users.length === 0 ? (
        <EmptyState icon={Users} title="No checks yet" description="Nobody ran a check in this period." />
      ) : (
        <>
          <ul className="divide-y border-t">
            {visible.map((user) => {
              const name = personLabel(user.display_name, user.email);
              return (
                <li key={user.user_id ?? 'unattributed'}>
                  <button
                    type="button"
                    disabled={!user.user_id}
                    onClick={() => onSelect(user)}
                    className="group flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors enabled:hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:outline-none dark:enabled:hover:bg-neutral-900/60"
                  >
                    <PersonAvatar name={user.display_name} email={user.email} src={user.avatar_url} size="sm" />
                    <span className="block min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-medium">{name}</span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCount(user.runs)}</span>
                      </span>
                      <Meter value={user.runs / top} className="my-1.5" />
                      <span className="block truncate text-xs text-muted-foreground" title={formatAbsolute(user.last_run_at)}>
                        Last check {formatRelativeInline(user.last_run_at)}
                        {user.problem_runs > 0 && ` · ${formatCount(user.problem_runs)} didn't finish`}
                      </span>
                    </span>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-enabled:group-hover:opacity-100"
                      aria-hidden
                    />
                  </button>
                </li>
              );
            })}
          </ul>
          {users.length > COLLAPSED_COUNT && (
            <div className="border-t px-5 pt-2">
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {expanded ? 'Show fewer' : `Show all ${users.length}`}
              </button>
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}
