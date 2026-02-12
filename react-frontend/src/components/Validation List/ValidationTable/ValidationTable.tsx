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
import { ArrowDown, ArrowUpDown } from 'lucide-react';
import { cn } from '../../../lib/utils';

type ValidationTableProps = {
  identifierData: IdentifierGroupedData;
  category: ValidationCategory;
  textBoxData: { [key: string]: TextBoxData };
  validationClassifiers: { [key: string]: ClassifierData };
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
      record.context
    );
  }
  if (key === 'help') {
    return (
      <div className="flex justify-end">
        {helpers.renderHelpLink(record.classifier.help_article)}
      </div>
    );
  }
  return null;
}

const ValidationTable = ({
  identifierData,
  category,
  textBoxData,
  validationClassifiers,
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
      <TableHead key="help" className="w-[100px] text-right text-muted-foreground">
        Help
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

    switch (category) {
      case ValidationCategory.text_boxes:
        return [
          idCol('Text Box Content', 'textBoxContent'),
          pageCol(),
          typeCol(),
          messageCol(),
          helpCol(),
        ];
      case ValidationCategory.fonts:
        return [
          idCol('Font Name', 'identifier'),
          typeCol(),
          messageCol(),
          helpCol(),
        ];
      case ValidationCategory.images:
        return [
          idCol('Image Name', 'identifier'),
          typeCol(),
          messageCol(),
          helpCol(),
        ];
      case ValidationCategory.par_styles:
      case ValidationCategory.char_styles:
        return [
          idCol('Style', 'identifier'),
          typeCol(),
          messageCol(),
          helpCol(),
        ];
      case ValidationCategory.general:
        return [typeCol(), messageCol(), helpCol()];
      default:
        return [typeCol(), messageCol(), helpCol()];
    }
  }, [category, sortKey, sortDir]);

  const headerKeys = useMemo(() => {
    switch (category) {
      case ValidationCategory.text_boxes:
        return ['identifier', 'page', 'type', 'message', 'help'];
      case ValidationCategory.fonts:
      case ValidationCategory.images:
      case ValidationCategory.par_styles:
      case ValidationCategory.char_styles:
        return ['identifier', 'type', 'message', 'help'];
      default:
        return ['type', 'message', 'help'];
    }
  }, [category]);

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
      <Table>
        <TableHeader>
          <TableRow className="border-border/60 bg-muted/40 hover:bg-muted/40">
            {columns}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.map((record) => (
            <TableRow
              key={record.key}
              className="border-border/40 transition-colors hover:bg-muted/30"
            >
              {headerKeys.map((k) => (
                <TableCell
                  key={k}
                  className={cn(
                    'py-3 text-sm',
                    k === 'help' && 'text-right'
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default ValidationTable;
