import React, { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import {
  TableDataItem,
  ValidationCategory,
  TextBoxData,
  IdentifierGroupedData,
  ClassifierData,
} from '../../../types';
import {
  transformDataForTable,
  renderHelpLink,
  getValidationTag,
  renderMessageWithContextForTable,
} from '../../helpers';
import { notifyExtensionToHighlight } from '../../../utils/extensionHighlight';
import { ArrowDown, ArrowUpDown, LocateFixed } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../../ui/tooltip';
import { cn } from '../../../lib/utils';

type ValidationTableProps = {
  identifierData: IdentifierGroupedData;
  category: ValidationCategory;
  textBoxData: { [key: string]: TextBoxData };
  validationClassifiers: { [key: string]: ClassifierData };
  fromExtension?: boolean;
};

type SortKey =
  | 'identifier'
  | 'page_name'
  | 'type'
  | 'message'
  | 'textBoxContent';
type SortDir = 'asc' | 'desc';

function sortData(
  data: TableDataItem[],
  sortKey: SortKey | null,
  sortDir: SortDir
): TableDataItem[] {
  if (!sortKey) return data;
  return [...data].sort((a, b) => {
    let aVal: string, bVal: string;
    switch (sortKey) {
      case 'identifier':
        aVal = a.identifier;
        bVal = b.identifier;
        break;
      case 'page_name':
        aVal = a.page_name;
        bVal = b.page_name;
        break;
      case 'type':
        aVal = a.classifier.label;
        bVal = b.classifier.label;
        break;
      case 'message':
        aVal = a.classifier.message;
        bVal = b.classifier.message;
        break;
      case 'textBoxContent':
        aVal = a.textBox?.content ?? '';
        bVal = b.textBox?.content ?? '';
        break;
      default:
        return 0;
    }
    const cmp = aVal.localeCompare(bVal);
    return sortDir === 'asc' ? cmp : -cmp;
  });
}

function SortableHead({
  label,
  sortKey,
  currentSortKey,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  currentSortKey: SortKey | null;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const isActive = currentSortKey === sortKey;
  return (
    <TableHead
      className={cn(
        'cursor-pointer select-none whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground',
        className
      )}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1.5">
        {label}
        {isActive ? (
          <ArrowDown
            className={cn('h-3.5 w-3.5 shrink-0', sortDir === 'desc' && 'rotate-180')}
            aria-hidden
          />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
        )}
      </div>
    </TableHead>
  );
}

function getCellContent(
  record: TableDataItem,
  key: string,
  category: ValidationCategory,
  helpers: {
    getValidationTag: typeof getValidationTag;
    renderMessageWithContextForTable: typeof renderMessageWithContextForTable;
    renderHelpLink: typeof renderHelpLink;
  }
): React.ReactNode {
  if (key === 'identifier') {
    if (category === ValidationCategory.text_boxes) {
      return (
        <span className="font-medium text-foreground">
          {record.textBox?.content ?? '—'}
        </span>
      );
    }
    return (
      <span className="font-medium text-foreground">{record.identifier}</span>
    );
  }
  if (key === 'page') {
    return (
      <span className="font-medium text-foreground">{record.page_name}</span>
    );
  }
  if (key === 'type') {
    return helpers.getValidationTag(
      record.classifier.label,
      record.validationType,
      false,
      true
    );
  }
  if (key === 'message') {
    return helpers.renderMessageWithContextForTable(
      record.classifier.message,
      record.context,
      record.context_details
    );
  }
  if (key === 'help') {
    return (
      <div className="flex justify-end">
        {helpers.renderHelpLink(record.classifier.help_article)}
      </div>
    );
  }
  if (key === 'locate') {
    const hasValidDataId = record.data_id && record.data_id !== 'null';
    if (!hasValidDataId) return <span className="text-muted-foreground/30">—</span>;
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center justify-center text-muted-foreground group-hover:text-primary">
              <LocateFixed className="h-4 w-4" aria-hidden />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            Click row to highlight on Frontify page
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return null;
}

const ValidationTable = ({
  identifierData,
  category,
  textBoxData,
  validationClassifiers,
  fromExtension = false,
}: ValidationTableProps) => {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const data = useMemo(
    () =>
      transformDataForTable(
        identifierData,
        validationClassifiers,
        textBoxData
      ),
    [identifierData, validationClassifiers, textBoxData]
  );

  const handleSort = (key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return key;
      }
      setSortDir('asc');
      return key;
    });
  };

  const sortedData = useMemo(
    () => sortData(data, sortKey, sortDir),
    [data, sortKey, sortDir]
  );

  const columns = useMemo(() => {
    const idCol = (label: string, key: SortKey) => (
      <SortableHead
        key="identifier"
        label={label}
        sortKey={key}
        currentSortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
      />
    );
    const typeCol = () => (
      <SortableHead
        key="type"
        label="Type"
        sortKey="type"
        currentSortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
      />
    );
    const messageCol = () => (
      <SortableHead
        key="message"
        label="Message"
        sortKey="message"
        currentSortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
      />
    );
    const helpCol = () => (
      <TableHead key="help" className="w-9 text-right text-muted-foreground text-xs">
        Help
      </TableHead>
    );
    const locateCol = () => (
      <TableHead key="locate" className="w-[48px] text-center text-muted-foreground" title="Show on Frontify page">
        <LocateFixed className="h-4 w-4 inline-block" aria-hidden />
      </TableHead>
    );
    const pageCol = () => (
      <SortableHead
        key="page"
        label="Page"
        sortKey="page_name"
        currentSortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
      />
    );

    const withLocate = (cols: React.ReactNode[]) =>
      fromExtension ? [...cols, locateCol()] : cols;
    switch (category) {
      case ValidationCategory.text_boxes:
        return withLocate([
          idCol('Text Box Content', 'textBoxContent'),
          pageCol(),
          typeCol(),
          messageCol(),
          helpCol(),
        ]);
      case ValidationCategory.fonts:
        return withLocate([
          idCol('Font Name', 'identifier'),
          typeCol(),
          messageCol(),
          helpCol(),
        ]);
      case ValidationCategory.images:
        return withLocate([
          idCol('Image Name', 'identifier'),
          typeCol(),
          messageCol(),
          helpCol(),
        ]);
      case ValidationCategory.par_styles:
      case ValidationCategory.char_styles:
        return withLocate([
          idCol('Style', 'identifier'),
          typeCol(),
          messageCol(),
          helpCol(),
        ]);
      case ValidationCategory.general:
        return withLocate([typeCol(), messageCol(), helpCol()]);
      default:
        return withLocate([typeCol(), messageCol(), helpCol()]);
    }
  }, [category, sortKey, sortDir, fromExtension]);

  const headerKeys = useMemo(() => {
    const base: string[] =
      category === ValidationCategory.text_boxes
        ? ['identifier', 'page', 'type', 'message', 'help']
        : category === ValidationCategory.general
          ? ['type', 'message', 'help']
          : ['identifier', 'type', 'message', 'help'];
    return fromExtension ? [...base, 'locate'] : base;
  }, [category, fromExtension]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        <Table>
        <TableHeader>
          <TableRow className="border-border/60 bg-muted/40 hover:bg-muted/40">
            {columns}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.map((record) => {
            const hasValidDataId = record.data_id && record.data_id !== 'null';
            const isClickable = fromExtension && hasValidDataId;
            return (
            <TableRow
              key={record.key}
              className={cn(
                'border-border/40 transition-colors group',
                isClickable
                  ? 'cursor-pointer hover:bg-primary/5 hover:ring-1 hover:ring-inset hover:ring-primary/20'
                  : 'hover:bg-muted/30'
              )}
              onClick={() =>
                isClickable &&
                notifyExtensionToHighlight(
                  record.data_id,
                  record.context_details?.text != null
                    ? [record.context_details.text]
                    : record.context
                      ? [record.context]
                      : undefined,
                  record.spread_id
                )
              }
            >
              {headerKeys.map((k) => (
                <TableCell
                  key={k}
                  className={cn(
                    'py-3 text-sm',
                    k === 'help' && 'text-right',
                    k === 'locate' && 'text-center'
                  )}
                >
                  {getCellContent(record, k, category, {
                    getValidationTag,
                    renderMessageWithContextForTable,
                    renderHelpLink,
                  })}
                </TableCell>
              ))}
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
    </TooltipProvider>
  );
};

export default ValidationTable;
