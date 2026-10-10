import React from 'react';
import { Filter } from 'lucide-react';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { formatAbsolute, PersonCell } from '../layout/page-kit';
import { RunStatusPill } from './Reliability';
import { CopyButton } from './parts';
import { formatCount, formatDuration, formatFileSize, lowerFirst, sourceLabel, stageLabel } from './format';
import type { RunRow } from './types';

function Field({ label, children, copy }: { label: string; children: React.ReactNode; copy?: string }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)_auto] items-center gap-3 py-2 text-[13px]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate font-medium text-foreground">{children}</dd>
      {copy ? <CopyButton value={copy} label={`Copy ${label.toLowerCase()}`} /> : <span className="w-6" />}
    </div>
  );
}

/** Everything recorded about one check, for debugging and for following up with the agent. */
export function RunSheet({
  run,
  onClose,
  onFilterTemplate,
  onFilterAgent,
}: {
  run: RunRow | null;
  onClose: () => void;
  onFilterTemplate: (run: RunRow) => void;
  onFilterAgent: (run: RunRow) => void;
}) {
  return (
    <Sheet open={run != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg">
        {run && (
          <>
            <SheetHeader className="border-b px-6 pb-5 pt-6 text-left">
              <div>
                <RunStatusPill status={run.status} />
              </div>
              <SheetTitle className="break-all pr-6 text-xl tracking-tight">{run.template_name}</SheetTitle>
              <SheetDescription>{formatAbsolute(run.timestamp)}</SheetDescription>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-6 px-6 py-5">
              {run.status !== 'completed' && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <h3 className="text-[13px] font-semibold">
                      {run.status === 'failed' ? 'Crashed' : 'Rejected'} while {lowerFirst(stageLabel(run.stopped_at_stage))}
                    </h3>
                    {run.error_message && <CopyButton value={run.error_message} label="Copy error" />}
                  </div>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-neutral-50 p-3 font-mono text-xs leading-relaxed dark:bg-neutral-900">
                    {run.error_message || 'No error message recorded'}
                  </pre>
                </div>
              )}

              <div>
                <h3 className="mb-1 text-[13px] font-semibold">Run by</h3>
                {run.user_id ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
                    <PersonCell name={run.display_name} email={run.email} />
                    <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={() => onFilterAgent(run)}>
                      <Filter className="h-3 w-3" aria-hidden />
                      Their checks
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Not recorded (older run or unauthenticated).</p>
                )}
              </div>

              <div>
                <h3 className="text-[13px] font-semibold">Details</h3>
                <dl className="divide-y">
                  {run.status === 'completed' && (
                    <Field label="Findings">
                      {formatCount(run.total_errors ?? 0)} blockers · {formatCount(run.total_warnings ?? 0)} warnings ·{' '}
                      {formatCount(run.total_infos ?? 0)} infos
                    </Field>
                  )}
                  <Field label="Source">{sourceLabel(run.source_type)}</Field>
                  <Field label="Duration">{formatDuration(run.duration_ms)}</Field>
                  <Field label="File size">{formatFileSize(run.file_size_bytes)}</Field>
                  <Field label="App version" copy={run.app_version ?? undefined}>
                    {run.app_version ?? <span className="text-muted-foreground">Not recorded</span>}
                  </Field>
                  <Field label="Run ID" copy={run.id}>
                    <span className="font-mono text-xs">{run.id}</span>
                  </Field>
                  <Field label="Time (UTC)" copy={run.timestamp}>
                    <span className="font-mono text-xs">{run.timestamp}</span>
                  </Field>
                </dl>
              </div>
            </div>

            <div className="sticky bottom-0 border-t bg-background px-6 py-4">
              <Button variant="outline" className="w-full gap-2" onClick={() => onFilterTemplate(run)}>
                <Filter className="h-4 w-4" aria-hidden />
                All checks of this template
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
