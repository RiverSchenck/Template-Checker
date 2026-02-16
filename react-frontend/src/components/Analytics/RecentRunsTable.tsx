import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Button } from '../ui/button';
import { formatDuration, formatFileSize, getSourceTypeLabel } from './utils';
import { RECENT_RUNS_PAGE_SIZE } from './constants';

interface RecentRun {
  id?: string;
  template_name?: string;
  source_type?: string;
  total_errors?: number;
  total_warnings?: number;
  total_infos?: number;
  duration_ms?: number;
  file_size_bytes?: number;
  timestamp?: string;
}

interface RecentRunsTableProps {
  runs: RecentRun[];
  page: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
}

export function RecentRunsTable({
  runs,
  page,
  onPageChange,
  pageSize = RECENT_RUNS_PAGE_SIZE,
}: RecentRunsTableProps) {
  const totalPages = Math.max(1, Math.ceil(runs.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const start = currentPage * pageSize;
  const end = Math.min(start + pageSize, runs.length);
  const paginatedRuns = runs.slice(start, end);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Runs</CardTitle>
        <CardDescription>
          Latest template check runs in the selected period (up to 50)
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-hidden">
        <div className="min-w-0 rounded-md border bg-card">
          <div className="min-w-0 overflow-x-auto">
            <Table className="w-full table-auto">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="bg-muted/60 w-auto min-w-[100px] px-2 font-semibold">Template</TableHead>
                  <TableHead className="bg-muted/60 w-24 shrink-0 px-2 font-semibold whitespace-nowrap">Source</TableHead>
                  <TableHead className="bg-muted/60 w-12 shrink-0 px-2 text-right font-semibold">E</TableHead>
                  <TableHead className="bg-muted/60 w-12 shrink-0 px-2 text-right font-semibold">W</TableHead>
                  <TableHead className="bg-muted/60 w-12 shrink-0 px-2 text-right font-semibold">I</TableHead>
                  <TableHead className="bg-muted/60 w-24 shrink-0 px-2 font-semibold whitespace-nowrap">Duration</TableHead>
                  <TableHead className="bg-muted/60 w-24 shrink-0 px-2 font-semibold whitespace-nowrap">Size</TableHead>
                  <TableHead className="bg-muted/60 w-auto min-w-[120px] px-2 font-semibold">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 px-2 text-center text-muted-foreground">
                      No recent runs
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedRuns.map((run, idx) => (
                    <TableRow
                      key={run.id ?? start + idx}
                      className={idx % 2 === 1 ? 'bg-muted/20' : undefined}
                    >
                      <TableCell
                        className="max-w-0 truncate px-2 py-2 font-medium"
                        title={run.template_name ?? ''}
                      >
                        {run.template_name ?? '—'}
                      </TableCell>
                      <TableCell className="shrink-0 truncate px-2 py-2 text-muted-foreground whitespace-nowrap">
                        {getSourceTypeLabel(run.source_type || '')}
                      </TableCell>
                      <TableCell
                        className={`shrink-0 px-2 py-2 text-right tabular-nums whitespace-nowrap ${(run.total_errors ?? 0) > 0 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}
                      >
                        {run.total_errors ?? 0}
                      </TableCell>
                      <TableCell
                        className={`shrink-0 px-2 py-2 text-right tabular-nums whitespace-nowrap ${(run.total_warnings ?? 0) > 0 ? 'text-warning font-medium' : 'text-muted-foreground'}`}
                      >
                        {run.total_warnings ?? 0}
                      </TableCell>
                      <TableCell className="shrink-0 px-2 py-2 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                        {run.total_infos ?? 0}
                      </TableCell>
                      <TableCell className="shrink-0 truncate px-2 py-2 tabular-nums text-muted-foreground whitespace-nowrap">
                        {formatDuration(run.duration_ms ?? 0)}
                      </TableCell>
                      <TableCell className="shrink-0 truncate px-2 py-2 tabular-nums text-muted-foreground whitespace-nowrap">
                        {formatFileSize(run.file_size_bytes ?? 0)}
                      </TableCell>
                      <TableCell
                        className="max-w-0 truncate px-2 py-2 text-muted-foreground text-sm"
                        title={run.timestamp ? new Date(run.timestamp).toLocaleString() : ''}
                      >
                        {run.timestamp ? new Date(run.timestamp).toLocaleString() : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {runs.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-3">
              <span className="text-sm text-muted-foreground">
                Showing {start + 1}–{end} of {runs.length} run{runs.length === 1 ? '' : 's'}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(Math.max(0, currentPage - 1))}
                  disabled={currentPage <= 0}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[6rem] text-center text-sm text-muted-foreground">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
                  disabled={currentPage >= totalPages - 1}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
