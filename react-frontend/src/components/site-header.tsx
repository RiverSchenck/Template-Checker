import React from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Separator } from './ui/separator';
import { SidebarTrigger } from './ui/sidebar';
import ReuploadButton from './Stat Group/ReuploadButton';
import { ValidationResult } from '../types';

function getPageTitle(pathname: string, templateName?: string | null): React.ReactNode {
  if (pathname === '/' || pathname === '') return 'Check Template';
  if (pathname.startsWith('/results')) {
    if (templateName) {
      return (
        <>
          Results
          <ChevronRight className="mx-1 h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
          {templateName}
        </>
      );
    }
    return 'Results';
  }
  if (pathname.startsWith('/analytics')) return 'Analytics';
  return 'Template Checker';
}

type SiteHeaderProps = {
  templateName?: string | null;
  checkerResults?: ValidationResult | null;
  checkerResponse?: (jsonResponse: ValidationResult, keepCurrentAsPrevious?: boolean) => void;
};

export function SiteHeader({ templateName, checkerResults, checkerResponse }: SiteHeaderProps) {
  const location = useLocation();
  const title = getPageTitle(location.pathname, templateName);
  const showActions = location.pathname.startsWith('/results') && checkerResults && checkerResponse;

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-neutral-700 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4 bg-neutral-700"
        />
        <h1 className="flex min-w-0 flex-1 items-center text-sm">{title}</h1>
        {showActions && (
          <ReuploadButton
            checkerResponse={checkerResponse}
            className="h-8 gap-1.5 px-2.5 text-xs [&_svg]:size-3.5"
          />
        )}
      </div>
    </header>
  );
}
