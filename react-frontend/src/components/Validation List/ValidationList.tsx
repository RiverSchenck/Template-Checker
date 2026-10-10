import React, { useState } from 'react';
import { History, Sparkles } from 'lucide-react';
import { ValidationResult } from '../../types';
import ReportView from '../Report/ReportView';
import ClassicValidationList from './ClassicValidationList';

type ValidationListProps = {
  jsonResponse: ValidationResult;
  previousJsonResponse?: ValidationResult | null;
  checkerResponse: (jsonResponse: ValidationResult) => void;
  seeDetails?: boolean;
};

type ResultsView = 'report' | 'classic';

// Remembered per browser so people who prefer the old list keep it.
const VIEW_STORAGE_KEY = 'results-view';

function readStoredView(): ResultsView {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === 'classic' ? 'classic' : 'report';
  } catch {
    return 'report';
  }
}

function ValidationList({ jsonResponse, previousJsonResponse, checkerResponse, seeDetails }: ValidationListProps) {
  const [view, setView] = useState<ResultsView>(readStoredView);

  const changeView = (next: ResultsView) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // Storage unavailable (e.g. private mode); the choice just isn't remembered.
    }
  };

  if (view === 'classic') {
    return (
      <div className="h-full w-full min-w-0 overflow-x-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-[4%] py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" aria-hidden />
            You’re using the classic view.
          </span>
          <button
            type="button"
            onClick={() => changeView('report')}
            className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-2 hover:underline"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Switch to the new view
          </button>
        </div>
        <ClassicValidationList
          jsonResponse={jsonResponse}
          previousJsonResponse={previousJsonResponse}
          checkerResponse={checkerResponse}
          seeDetails={seeDetails}
        />
      </div>
    );
  }

  return (
    <div className="h-full w-full min-w-0 overflow-x-hidden">
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-[3%]">
        <div className="flex justify-end pt-3">
          <button
            type="button"
            onClick={() => changeView('classic')}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            <History className="h-3.5 w-3.5" aria-hidden />
            Prefer the classic view?
          </button>
        </div>
        <ReportView result={jsonResponse} previous={previousJsonResponse} />
      </div>
    </div>
  );
}

export default ValidationList;
