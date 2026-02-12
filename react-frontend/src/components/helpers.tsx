import React from 'react';
import { AlertCircle, AlertTriangle, Info, HelpCircle } from 'lucide-react';
import {
  IdentifierGroupedData,
  ClassifierData,
  TableDataItem,
  ValidationType,
  TextBoxData,
  ValidationItem,
  ValidationEntries,
} from '../types';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import { cn } from '../lib/utils';

export function transformDataForTable(
  identifierData: IdentifierGroupedData,
  validationClassifiers: { [key: string]: ClassifierData },
  textBoxes: { [key: string]: TextBoxData }
): TableDataItem[] {
  const tableData: TableDataItem[] = [];
  Object.entries(identifierData).forEach(([identifier, entries]) => {
    (['errors', 'warnings', 'infos'] as ValidationType[]).forEach((type) => {
      entries[type].forEach((issue, index) => {
        if (validationClassifiers[issue.validationClassifier]) {
          const textBoxData = issue.identifier ? textBoxes[issue.identifier] : undefined;
          tableData.push({
            key: `${identifier}-${issue.validationClassifier}-${type}-${index}`,
            identifier,
            type: issue.validationClassifier,
            page_id: issue.page_id,
            page_name: issue.page_name,
            context: issue.context,
            validationType: type,
            textBox: textBoxData,
            classifier: validationClassifiers[issue.validationClassifier],
          });
        }
      });
    });
  });
  return tableData;
}

export function renderHelpLink(helpArticleUrl: string | null): React.ReactNode {
  if (!helpArticleUrl) return null;
  return (
    <Button variant="outline" size="sm" className="gap-1.5 shrink-0" asChild>
      <a href={helpArticleUrl} target="_blank" rel="noopener noreferrer">
        <HelpCircle className="h-3.5 w-3.5" />
        Help
      </a>
    </Button>
  );
}

export function renderMessageElement(classifierMessage: string, context: string): React.ReactNode {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span>{classifierMessage}</span>
      {context && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground">
              Context
            </Button>
          </PopoverTrigger>
          <PopoverContent className="max-w-sm" side="top">
            <p className="text-sm">{context}</p>
          </PopoverContent>
        </Popover>
      )}
    </span>
  );
}

/** Message + context for table: message on first line, context inline below in muted text. */
export function renderMessageWithContextForTable(
  classifierMessage: string,
  context: string
): React.ReactNode {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-sm text-foreground">{classifierMessage}</span>
      {context ? (
        <span className="text-xs leading-relaxed text-muted-foreground">{context}</span>
      ) : null}
    </div>
  );
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
