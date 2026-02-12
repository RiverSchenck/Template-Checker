import React from 'react';
import { ValidationResult } from '../../types';
import countValidationIssues from '../ValidationCount';
import StatsToggle from './StatDetails';
import ReuploadButton from './ReuploadButton';
import { Card, CardContent } from '../ui/card';
import { Separator } from '../ui/separator';

type ValidationStatsProps = {
  jsonResponse: ValidationResult;
  checkerResponse: (jsonResponse: ValidationResult) => void;
  previousJsonResponse?: ValidationResult | null;
  seeDetails?: boolean;
};

function ValidationStats({ jsonResponse, checkerResponse, previousJsonResponse, seeDetails }: ValidationStatsProps) {
  const { totalErrors, totalWarnings, totalInfos } = countValidationIssues(jsonResponse);

  return (
    <Card className="mt-3 mb-4 w-full rounded-xl border-border/50 shadow-sm">
      <CardContent className="flex flex-col items-center pb-2 pt-5">
        <div className="flex w-full max-w-sm items-baseline justify-center gap-8">
          <div className="flex flex-col items-center gap-0.5">
            <span className="font-guise text-3xl font-semibold tabular-nums tracking-tight text-destructive">
              {totalErrors}
            </span>
            <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Errors
            </span>
          </div>
          <Separator orientation="vertical" className="h-8 shrink-0" decorative />
          <div className="flex flex-col items-center gap-0.5">
            <span className="font-guise text-3xl font-semibold tabular-nums tracking-tight text-amber-600 dark:text-amber-400">
              {totalWarnings}
            </span>
            <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Warnings
            </span>
          </div>
          <Separator orientation="vertical" className="h-8 shrink-0" decorative />
          <div className="flex flex-col items-center gap-0.5">
            <span className="font-guise text-3xl font-semibold tabular-nums tracking-tight text-blue-600 dark:text-blue-400">
              {totalInfos}
            </span>
            <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Infos
            </span>
          </div>
        </div>
        <StatsToggle
          jsonResponse={jsonResponse}
          previousJsonResponse={previousJsonResponse}
          seeDetails={seeDetails}
        />
      </CardContent>
    </Card>
  );
}

export default ValidationStats;
