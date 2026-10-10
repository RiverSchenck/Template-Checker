import React from 'react';
import { Meter, SectionCard } from './parts';
import { categoryLabel, formatPercent, ratio } from './format';
import type { Overview } from './types';

export function Categories({ overview }: { overview: Overview }) {
  const completed = overview.current.completed;
  const rows = overview.categories.map((c) => ({ ...c, share: ratio(c.runs_affected, completed) ?? 0 }));

  return (
    <SectionCard
      title="By area"
      description="Share of checks with at least one issue in each area"
      info="Areas follow the checker's categories. A check can have issues in several areas, so these don't add up to 100%."
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No issues found in this period.</p>
      ) : (
        <ul className="space-y-3.5">
          {rows.map((row) => (
            <li key={row.category} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
              <span className="truncate text-sm">{categoryLabel(row.category)}</span>
              <span className="text-sm font-medium tabular-nums">{formatPercent(row.share)}</span>
              <Meter value={row.share} className="col-span-2" />
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
