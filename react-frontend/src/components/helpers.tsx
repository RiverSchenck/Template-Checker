import React from 'react';
import { AlertCircle, AlertTriangle, Info, ExternalLink } from 'lucide-react';
import {
  IdentifierGroupedData,
  ContextDetails,
  ValidationType,
  ValidationItem,
  ValidationEntries,
} from '../types';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { cn } from '../lib/utils';

export function renderHelpLink(helpArticleUrl: string | null): React.ReactNode {
  if (!helpArticleUrl) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={helpArticleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring underline-offset-2 hover:underline"
          aria-label="Open help article"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </TooltipTrigger>
      <TooltipContent side="top">Help article</TooltipContent>
    </Tooltip>
  );
}

const CONTEXT_TEXT_TRUNCATE = 200;

/** Render structured context when context_details is present; otherwise fall back to context string. */
export function renderContextContent(
  context: string,
  context_details?: ContextDetails | null
): React.ReactNode {
  const details = context_details;
  const hasOverrides =
    details?.text !== undefined ||
    (details?.overrides && Object.keys(details.overrides).length > 0);
  if (hasOverrides) {
    const text = details?.text;
    const overrides = details?.overrides;
    return (
      <div className="flex min-w-0 flex-col gap-1.5 text-sm">
        {text !== undefined && text !== '' && (
          <span className="text-foreground">
            Text: {text.length > CONTEXT_TEXT_TRUNCATE ? text.slice(0, CONTEXT_TEXT_TRUNCATE) + '…' : text}
          </span>
        )}
        {overrides && Object.keys(overrides).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {Object.entries(overrides).map(([k, v]) => (
              <Badge key={k} variant="secondary" className="text-[10px] font-normal">
                {k}: {v}
              </Badge>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (details?.inheritedFrom) {
    return (
      <span className="text-muted-foreground text-xs">
        Inherited from: <span className="text-foreground">{details.inheritedFrom}</span>
      </span>
    );
  }
  return context ? <span className="text-sm">{context}</span> : null;
}

export function getValidationTag(
  label: string,
  type: ValidationType,
  card: boolean = false,
  compact: boolean = false
): React.ReactNode {
  const className = cn(
    'inline-flex items-center rounded-md border-0 font-medium',
    compact ? 'gap-1 py-0.5 text-xs' : 'gap-2 py-0.5 text-base',
    card ? 'w-full max-w-full' : 'max-w-[190px]',
    type === 'errors' && 'text-destructive',
    type === 'warnings' && 'text-amber-600 dark:text-amber-400',
    type === 'infos' && 'text-blue-600 dark:text-blue-400'
  );
  const Icon =
    type === 'errors' ? AlertCircle : type === 'warnings' ? AlertTriangle : Info;
  return (
    <Badge variant="secondary" className={cn('bg-transparent font-medium', className)}>
      <Icon className={cn('shrink-0 opacity-80', compact ? 'h-3 w-3' : 'h-4 w-4')} aria-hidden />
      <span className="truncate">{label}</span>
    </Badge>
  );
}

export function isCategoryEmpty(data: IdentifierGroupedData): boolean {
  return Object.values(data).every(
    (entries) =>
      entries.errors.length === 0 &&
      entries.warnings.length === 0 &&
      entries.infos.length === 0
  );
}

export function groupItemsByClassifier(
  items: ValidationItem[]
): Record<string, ValidationItem[]> {
  return items.reduce((acc, item) => {
    const { validationClassifier } = item;
    if (!acc[validationClassifier]) acc[validationClassifier] = [];
    acc[validationClassifier].push(item);
    return acc;
  }, {} as Record<string, ValidationItem[]>);
}

/**
 * Merge identifier-grouped data into one entry per data_id so that all issues
 * for the same element (same data_id) appear in a single card.
 */
export function groupIdentifierDataByDataId(
  identifierData: IdentifierGroupedData
): Array<{ dataId: string; entries: ValidationEntries; identifiers: string[] }> {
  const byDataId = new Map<
    string,
    { errors: ValidationItem[]; warnings: ValidationItem[]; infos: ValidationItem[]; identifiers: Set<string> }
  >();
  const add = (item: ValidationItem, type: keyof ValidationEntries, identifier: string) => {
    const id = item.data_id ?? 'null';
    if (!byDataId.has(id)) {
      byDataId.set(id, { errors: [], warnings: [], infos: [], identifiers: new Set() });
    }
    const bucket = byDataId.get(id)!;
    bucket[type].push(item);
    bucket.identifiers.add(identifier);
  };
  Object.entries(identifierData).forEach(([identifier, entries]) => {
    entries.errors.forEach((i) => add(i, 'errors', identifier));
    entries.warnings.forEach((i) => add(i, 'warnings', identifier));
    entries.infos.forEach((i) => add(i, 'infos', identifier));
  });
  return Array.from(byDataId.entries()).map(([dataId, bucket]) => ({
    dataId,
    entries: { errors: bucket.errors, warnings: bucket.warnings, infos: bucket.infos },
    identifiers: Array.from(bucket.identifiers),
  }));
}

export type ValidationFilterState = {
  spreadId: string[] | null;
  pageId: string[] | null;
  validationType: ('errors' | 'warnings' | 'infos')[] | null;
  dataId: string | null;
};

export function filterByIdentifierFilters(
  identifierData: IdentifierGroupedData,
  filters: ValidationFilterState
): IdentifierGroupedData {
  const { spreadId, pageId, validationType, dataId } = filters;

  if (
    (!spreadId || spreadId.length === 0) &&
    (!pageId || pageId.length === 0) &&
    (!validationType || validationType.length === 0) &&
    !dataId
  ) {
    return identifierData;
  }

  const filtered: IdentifierGroupedData = {};

  Object.entries(identifierData).forEach(([identifier, entries]) => {
    const filterEntries = (items: ValidationItem[]) =>
      items.filter((item) => {
        if (spreadId?.length && !spreadId.includes(item.spread_id)) return false;
        if (pageId?.length && !pageId.includes(item.page_id)) return false;
        if (dataId && item.data_id !== dataId) return false;
        return true;
      });

    let filteredEntries: ValidationEntries;
    if (validationType?.length) {
      filteredEntries = {
        errors: validationType.includes('errors') ? filterEntries(entries.errors) : [],
        warnings: validationType.includes('warnings') ? filterEntries(entries.warnings) : [],
        infos: validationType.includes('infos') ? filterEntries(entries.infos) : [],
      };
    } else {
      filteredEntries = {
        errors: filterEntries(entries.errors),
        warnings: filterEntries(entries.warnings),
        infos: filterEntries(entries.infos),
      };
    }

    if (
      filteredEntries.errors.length > 0 ||
      filteredEntries.warnings.length > 0 ||
      filteredEntries.infos.length > 0
    ) {
      filtered[identifier] = filteredEntries;
    }
  });

  return filtered;
}
