import React, { useState } from 'react';
import { Check, Copy, Info, RotateCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

/** Small (i) with a definition on hover/focus, so everyone reads a metric the same way. */
export function InfoTip({ children, label = 'What this means' }: { children: React.ReactNode; label?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-grid h-4 w-4 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

/** A titled card for one analytics section. */
export function SectionCard({
  title,
  description,
  info,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  description?: React.ReactNode;
  /** Definition shown in an (i) tooltip next to the title. */
  info?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('flex min-w-0 flex-col rounded-xl border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.05)]', className)}>
      <header className="flex flex-col gap-3 px-5 pb-3 pt-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-[15px] font-semibold tracking-tight">
            {title}
            {info && <InfoTip label={`About ${title}`}>{info}</InfoTip>}
          </h2>
          {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </header>
      <div className={cn('min-w-0 flex-1 px-5 pb-5', bodyClassName)}>{children}</div>
    </section>
  );
}

/** Legend entry: a color swatch plus text in text ink (never the series color). */
export function LegendItem({ swatchClass, label, value }: { swatchClass: string; label: string; value?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={cn('h-2.5 w-2.5 shrink-0 rounded-[3px]', swatchClass)} aria-hidden />
      <span>{label}</span>
      {value && <span className="font-medium tabular-nums text-foreground">{value}</span>}
    </span>
  );
}

/** Thin horizontal meter for "share of checks" columns. */
export function Meter({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <span className={cn('block h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800', className)} aria-hidden>
      <span className="block h-full rounded-full bg-neutral-800 dark:bg-neutral-300" style={{ width: `${pct}%` }} />
    </span>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400"
    >
      <span className="min-w-0">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hover:bg-rose-100 dark:hover:bg-rose-500/20"
        >
          <RotateCw className="h-3 w-3" aria-hidden />
          Try again
        </button>
      )}
    </div>
  );
}

/** Icon button that copies text and briefly confirms. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={copied ? 'Copied' : label}
      title={copied ? 'Copied' : label}
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-neutral-100 hover:text-foreground dark:hover:bg-neutral-800"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
    </button>
  );
}
