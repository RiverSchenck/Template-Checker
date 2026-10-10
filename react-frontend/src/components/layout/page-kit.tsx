import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertCircle, RotateCw, Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Skeleton } from '../ui/skeleton';

/**
 * Shared building blocks for the settings-style pages (Users, Access requests, API keys).
 */

/** Primary page action: dark, slightly raised, matches the header icon tile. */
export const primaryActionClass =
  'h-10 gap-2 rounded-lg bg-gradient-to-b from-neutral-800 to-neutral-950 px-4 text-white ring-1 ring-black/80 ' +
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.25),0_6px_16px_-6px_rgba(0,0,0,0.45)] ' +
  'transition-[box-shadow,transform] hover:from-neutral-700 hover:to-neutral-900 ' +
  'hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_rgba(0,0,0,0.25),0_10px_22px_-8px_rgba(0,0,0,0.5)] ' +
  'active:translate-y-px dark:from-white dark:to-neutral-200 dark:text-neutral-900 dark:ring-white/20';

/** Positive confirm action (approve). */
export const approveActionClass =
  'gap-1.5 rounded-lg bg-gradient-to-b from-emerald-500 to-emerald-600 text-white ring-1 ring-emerald-700/60 ' +
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_1px_2px_rgba(4,120,87,0.3),0_4px_12px_-4px_rgba(5,150,105,0.45)] ' +
  'hover:from-emerald-500 hover:to-emerald-700 active:translate-y-px';

/** Quiet secondary action next to a primary one. */
export const secondaryActionClass =
  'gap-1.5 rounded-lg border-neutral-200 bg-background shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900';

export function PageShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="flex w-full min-w-0 flex-1 flex-col px-4 py-8 sm:px-6 lg:px-10">
      <div className={cn('mx-auto w-full max-w-5xl', className)}>{children}</div>
    </div>
  );
}

export function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2.5 text-[1.65rem] font-semibold leading-tight tracking-tight">
          <Icon className="h-6 w-6 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

type Tone = 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'violet';

const TONE_ICON: Record<Tone, string> = {
  neutral: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
  green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  red: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
  blue: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
};

/** Colored rounded icon chip. */
export function IconChip({ icon: Icon, tone = 'neutral', className }: { icon: LucideIcon; tone?: Tone; className?: string }) {
  return (
    <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', TONE_ICON[tone], className)}>
      <Icon className="h-4 w-4" strokeWidth={2} />
    </span>
  );
}

/** Slim callout above a panel, e.g. "3 access requests are waiting for review". */
export function Notice({
  icon,
  tone = 'amber',
  children,
  action,
}: {
  icon: LucideIcon;
  tone?: Tone;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border bg-card py-2 pl-2.5 pr-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <IconChip icon={icon} tone={tone} />
      <p className="min-w-0 flex-1 text-sm text-foreground">{children}</p>
      {action}
    </div>
  );
}

/** Card container for a list, with an optional toolbar row on top. */
export function Panel({
  toolbar,
  children,
  footer,
  className,
}: {
  toolbar?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('overflow-hidden rounded-xl border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.05)]', className)}>
      {toolbar && (
        <div className="flex flex-col gap-3 border-b bg-neutral-50/70 px-4 py-3 dark:bg-neutral-900/40 sm:flex-row sm:items-center sm:justify-between">
          {toolbar}
        </div>
      )}
      {children}
      {footer && (
        <div className="border-t bg-neutral-50/70 px-4 py-2.5 text-xs text-muted-foreground dark:bg-neutral-900/40">
          {footer}
        </div>
      )}
    </section>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={cn('relative flex w-full items-center sm:max-w-xs', className)}>
      <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-8 text-sm shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-muted-foreground focus:border-neutral-400 focus:ring-4 focus:ring-neutral-200 dark:focus:ring-neutral-800 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 grid h-5 w-5 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </label>
  );
}

/** Pill-style segmented control. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; count?: number }[];
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex h-9 shrink-0 items-center gap-0.5 rounded-lg border bg-neutral-100 p-0.5 dark:bg-neutral-900"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex h-full items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-background text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {o.label}
            {o.count != null && (
              <span
                className={cn(
                  'min-w-[1.25rem] rounded-full px-1.5 py-px text-center text-[10px] font-semibold tabular-nums',
                  active
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                    : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

const PILL_TONE: Record<Tone, { wrap: string; dot: string }> = {
  neutral: { wrap: 'bg-neutral-100 text-neutral-600 ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-700', dot: 'bg-neutral-400' },
  green: { wrap: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30', dot: 'bg-emerald-500' },
  amber: { wrap: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30', dot: 'bg-amber-500' },
  red: { wrap: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/30', dot: 'bg-rose-500' },
  blue: { wrap: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-500/30', dot: 'bg-sky-500' },
  violet: { wrap: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:ring-violet-500/30', dot: 'bg-violet-500' },
};

/** A status dot on its own, optionally pulsing. */
export function StatusDot({ tone = 'neutral', pulse }: { tone?: Tone; pulse?: boolean }) {
  const dot = PILL_TONE[tone].dot;
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      {pulse && <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', dot)} />}
      <span className={cn('relative inline-flex h-2 w-2 rounded-full', dot)} />
    </span>
  );
}

export function StatusPill({
  tone = 'neutral',
  children,
  pulse,
  icon: Icon,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  pulse?: boolean;
  icon?: LucideIcon;
  className?: string;
}) {
  const t = PILL_TONE[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        t.wrap,
        className
      )}
    >
      {Icon ? (
        <Icon className="h-3 w-3" strokeWidth={2.25} />
      ) : (
        <span className="relative flex h-1.5 w-1.5">
          {pulse && <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', t.dot)} />}
          <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', t.dot)} />
        </span>
      )}
      {children}
    </span>
  );
}

/* ---------- Identity ---------- */

/** Flat per-person tints: soft fill with darker initials, picked from the email. */
const AVATAR_TINTS = [
  'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
  'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
  'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200',
  'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-200',
  'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-200',
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initials(name: string | null | undefined, email: string | null | undefined): string {
  const n = name?.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }
  return (email?.[0] ?? '?').toUpperCase();
}

export function PersonAvatar({
  name,
  email,
  src,
  size = 'md',
  className,
}: {
  name?: string | null;
  email?: string | null;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const seed = email || name || '?';
  const tint = AVATAR_TINTS[hashString(seed) % AVATAR_TINTS.length];
  const dims = size === 'lg' ? 'h-11 w-11 text-sm' : size === 'sm' ? 'h-7 w-7 text-[10px]' : 'h-9 w-9 text-xs';
  return (
    <Avatar className={cn(dims, 'shrink-0 ring-2 ring-background', className)}>
      {src ? <AvatarImage src={src} alt="" referrerPolicy="no-referrer" /> : null}
      <AvatarFallback className={cn('font-semibold', tint)}>
        {initials(name, email)}
      </AvatarFallback>
    </Avatar>
  );
}

export function PersonCell({
  name,
  email,
  src,
  badge,
}: {
  name?: string | null;
  email?: string | null;
  src?: string | null;
  badge?: React.ReactNode;
}) {
  const primary = name?.trim() || email || 'Unknown';
  const secondary = name?.trim() ? email : null;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <PersonAvatar name={name} email={email} src={src} />
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{primary}</span>
          {badge}
        </div>
        {secondary && <p className="truncate text-xs text-muted-foreground">{secondary}</p>}
      </div>
    </div>
  );
}

/* ---------- States ---------- */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="relative mb-5">
        <div className="absolute -inset-6 rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.07)_0%,transparent_70%)]" />
        <div className="relative grid h-14 w-14 place-items-center rounded-2xl border bg-background shadow-[0_6px_20px_-8px_rgba(0,0,0,0.2)]">
          <Icon className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} />
        </div>
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** A panel's data failed to load. Shown in place of the list (not as a toast) so it can't be mistaken for "empty". */
export function ErrorState({
  title,
  description = 'Check your connection and try again.',
  onRetry,
}: {
  title: string;
  description?: React.ReactNode;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 grid h-10 w-10 place-items-center rounded-full bg-rose-500/10">
        <AlertCircle className="h-5 w-5 text-rose-500" strokeWidth={1.75} />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-lg border bg-background px-3 text-xs font-medium shadow-sm transition-colors hover:bg-muted"
        >
          <RotateCw className="h-3.5 w-3.5" aria-hidden />
          Try again
        </button>
      )}
    </div>
  );
}

/** Name/detail widths per row, so a list of placeholders doesn't look like a barcode. */
const ROW_WIDTHS = [
  ['w-40', 'w-56'],
  ['w-32', 'w-44'],
  ['w-48', 'w-52'],
  ['w-36', 'w-40'],
  ['w-44', 'w-60'],
];

/** Placeholder rows for a list. `leading` matches the row's avatar (people) or icon tile (keys). */
export function RowSkeleton({ rows = 4, leading = 'avatar' }: { rows?: number; leading?: 'avatar' | 'tile' }) {
  return (
    <div className="divide-y" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => {
        const [name, detail] = ROW_WIDTHS[i % ROW_WIDTHS.length];
        return (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
            <Skeleton className={cn('h-9 w-9 shrink-0', leading === 'avatar' ? 'rounded-full' : 'rounded-lg')} />
            <div className="flex-1 space-y-2">
              <Skeleton className={cn('h-3.5 rounded', name)} />
              <Skeleton className={cn('h-3 rounded', detail)} />
            </div>
            <Skeleton className="hidden h-5 w-16 rounded-full sm:block" />
          </div>
        );
      })}
    </div>
  );
}

/** Icon tile used at the top of confirm/create dialogs. */
export function DialogIcon({ icon: Icon, tone = 'neutral' }: { icon: LucideIcon; tone?: Tone }) {
  return (
    <div className={cn('mb-1 grid h-11 w-11 place-items-center rounded-xl', TONE_ICON[tone])}>
      <Icon className="h-5 w-5" strokeWidth={1.9} />
    </div>
  );
}

/** Highlighted subject inside a dialog (the user/key being acted on). */
export function DialogSubject({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 rounded-lg border bg-neutral-50 px-3 py-2.5 dark:bg-neutral-900">{children}</div>;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent', className)}
      aria-hidden
    />
  );
}

/* ---------- Dates ---------- */

export function formatAbsolute(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

/** "Just now", "5m ago", "3h ago", "Yesterday", "4d ago", then a date. */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const t = d.getTime();
  if (Number.isNaN(t)) return '—';
  const diff = Date.now() - t;
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < min) return 'Just now';
  if (diff < hour) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 2 * day) return 'Yesterday';
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  if (diff < 30 * day) return `${Math.floor(diff / (7 * day))}w ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** formatRelative for mid-sentence use ("Seen 3d ago", "Seen yesterday", "Seen Aug 30, 2026"). */
export function formatRelativeInline(iso: string | null | undefined): string {
  const s = formatRelative(iso);
  return s === 'Just now' || s === 'Yesterday' ? s.toLowerCase() : s;
}

export function isWithin(iso: string | null | undefined, ms: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && Date.now() - t <= ms;
}

export const DAY_MS = 24 * 60 * 60 * 1000;
