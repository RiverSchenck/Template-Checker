import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { PartyPopper } from 'lucide-react';
import type { CheckResult } from '../../types';
import type { Report } from './buildReport';

/** One is picked per template (by name), so the same result always says the same thing. */
const HEADLINES = [
  'Template champion.',
  'Spotless. Not a single issue.',
  'Clean as a whistle.',
  'Nothing to fix. Go grab a coffee.',
  'Chef’s kiss. Every check passed.',
  'Flawless. Frontify will love this one.',
];

// Results already celebrated, so coming back to the page doesn't fire the confetti again.
const celebrated = new WeakSet<CheckResult>();

function headlineFor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return HEADLINES[Math.abs(hash) % HEADLINES.length];
}

function celebrate(origin: HTMLElement | null) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const rect = origin?.getBoundingClientRect();
  const x = rect ? (rect.left + rect.width / 2) / window.innerWidth : 0.5;
  const y = rect ? (rect.top + rect.height / 2) / window.innerHeight : 0.4;
  const shot = (angle: number) =>
    confetti({
      particleCount: 70,
      angle,
      spread: 65,
      startVelocity: 42,
      ticks: 180,
      origin: { x, y },
      colors: ['#22c55e', '#7B58F8', '#f59e0b', '#38bdf8', '#f43f5e'],
      disableForReducedMotion: true,
    });
  shot(60);
  shot(120);
}

/** What a result with no issues at all shows: a small celebration, what was checked, then the pages. */
export function CleanResult({
  result,
  report,
  templateName,
  pageViewer,
}: {
  result: CheckResult;
  report: Report;
  templateName: string;
  pageViewer: React.ReactNode | null;
}) {
  const iconRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (celebrated.has(result)) return;
    celebrated.add(result);
    celebrate(iconRef.current);
  }, [result]);

  const checks = report.passedChecks.length;
  return (
    <>
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-6 py-10 text-center">
        <div
          ref={iconRef}
          className="grid h-14 w-14 place-items-center rounded-full bg-green-500/10 text-green-600 ring-1 ring-green-500/30 motion-safe:animate-[clean-pop_600ms_cubic-bezier(0.34,1.56,0.64,1)] dark:text-green-400"
        >
          <PartyPopper className="h-7 w-7" aria-hidden />
        </div>
        <div className="space-y-1">
          <p className="text-lg font-semibold text-foreground">{headlineFor(templateName)}</p>
          <p className="text-sm text-muted-foreground">
            All {checks} checks passed
            {report.checked.length > 0 && <> on {report.checked.map((c) => `${c.count} ${c.label}`).join(', ')}</>}.
          </p>
        </div>
        <p className="max-w-md text-xs text-muted-foreground">
          The checker can’t catch everything, so give it a quick look in Frontify too.
        </p>
      </div>
      {pageViewer}
    </>
  );
}
