import React, { useEffect, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useIsMobile } from '../../hooks/use-mobile';
import { Button } from '../ui/button';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { secondaryActionClass } from '../layout/page-kit';
import { viewerTimezone } from './api';
import { PRESET_DAYS } from './urlState';
import type { PeriodSelection } from './types';

const PRESET_LABELS: Record<number, string> = {
  7: 'Last 7 days',
  30: 'Last 30 days',
  90: 'Last 90 days',
  365: 'Last 12 months',
};
const MAX_RANGE_DAYS = 366;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fromIsoDay(s: string): Date {
  return new Date(`${s}T00:00:00`);
}

/** The calendar days a selection covers, as local dates. */
export function periodDays(period: PeriodSelection): { from: Date; to: Date } {
  if (period.kind === 'custom') return { from: fromIsoDay(period.start), to: fromIsoDay(period.end) };
  const to = startOfToday();
  const from = new Date(to);
  from.setDate(from.getDate() - (period.days - 1));
  return { from, to };
}

/** "Sep 11 – Oct 10", with years only when the range isn't within the current year. */
export function formatDays(from: Date, to: Date): string {
  const thisYear = new Date().getFullYear();
  const withYear = from.getFullYear() !== thisYear || to.getFullYear() !== thisYear;
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', withYear ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' });
  return from.toDateString() === to.toDateString() ? fmt(from) : `${fmt(from)} – ${fmt(to)}`;
}

function dayCount(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

/**
 * The page's one time control: a button showing the current range, opening presets plus a two-month calendar
 * for picking any range of whole days (up to a year).
 */
export function PeriodPicker({ period, onChange }: { period: PeriodSelection; onChange: (p: PeriodSelection) => void }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>();
  const today = startOfToday();
  const current = periodDays(period);

  // Start each visit to the calendar from what's on screen.
  useEffect(() => {
    if (open) setDraft(period.kind === 'custom' ? current : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const choosePreset = (days: number) => {
    onChange({ kind: 'preset', days });
    setOpen(false);
  };

  const draftComplete = Boolean(draft?.from && draft?.to);
  const defaultMonth = new Date(today.getFullYear(), today.getMonth() - (isMobile ? 0 : 1), 1);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('h-10 justify-between gap-2 px-3 text-sm font-medium', secondaryActionClass)}>
          <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span>{period.kind === 'preset' ? PRESET_LABELS[period.days] : formatDays(current.from, current.to)}</span>
          {period.kind === 'preset' && (
            <span className="hidden font-normal text-muted-foreground sm:inline">{formatDays(current.from, current.to)}</span>
          )}
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={16} className="w-auto max-w-[calc(100vw-2rem)] p-0">
        <div className="flex flex-col sm:flex-row">
          <div className="flex gap-1 overflow-x-auto border-b p-2 sm:w-44 sm:flex-col sm:border-b-0 sm:border-r">
            {PRESET_DAYS.map((days) => {
              const active = period.kind === 'preset' && period.days === days && !draft?.from;
              return (
                <button
                  key={days}
                  type="button"
                  onClick={() => choosePreset(days)}
                  className={cn(
                    'whitespace-nowrap rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active ? 'bg-neutral-100 font-medium text-foreground dark:bg-neutral-800' : 'text-muted-foreground hover:bg-neutral-50 hover:text-foreground dark:hover:bg-neutral-900'
                  )}
                >
                  {PRESET_LABELS[days]}
                </button>
              );
            })}
          </div>
          <div className="p-3">
            <Calendar
              mode="range"
              numberOfMonths={isMobile ? 1 : 2}
              defaultMonth={draft?.from ?? defaultMonth}
              selected={draft}
              onSelect={setDraft}
              disabled={{ after: today }}
              endMonth={today}
              max={MAX_RANGE_DAYS - 1}
              weekStartsOn={1}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {draft?.from
              ? draft.to
                ? `${formatDays(draft.from, draft.to)} · ${dayCount(draft.from, draft.to)} days`
                : 'Pick an end date'
              : `Pick a start date · Times in ${viewerTimezone()}`}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!draftComplete}
              onClick={() => {
                if (!draft?.from || !draft.to) return;
                onChange({ kind: 'custom', start: isoDay(draft.from), end: isoDay(draft.to) });
                setOpen(false);
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
