import React from 'react';
import { CheckResult } from '../../types';
import ReportView from '../Report/ReportView';

type ValidationListProps = {
  jsonResponse: CheckResult;
  previousJsonResponse?: CheckResult | null;
};

function ValidationList({ jsonResponse, previousJsonResponse }: ValidationListProps) {
  return (
    <div className="h-full w-full min-w-0 overflow-x-hidden">
      <div className="mx-auto w-full max-w-[1400px] px-4 pt-3 sm:px-[3%]">
        <ReportView result={jsonResponse} previous={previousJsonResponse} />
      </div>
    </div>
  );
}

export default ValidationList;
