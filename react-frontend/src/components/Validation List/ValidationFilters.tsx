import React from 'react';
import { ChevronDown, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { ValidationFilterState } from '../helpers';
import { cn } from '../../lib/utils';

export type { ValidationFilterState };

type FilterOption = { value: string; label: string };

type ValidationFiltersProps = {
  filters: ValidationFilterState;
  onFiltersChange: (filters: ValidationFilterState) => void;
  spreadOptions: FilterOption[];
  pageOptions: FilterOption[];
  validationTypeOptions: FilterOption[];
  dataIdOptions: FilterOption[];
};

function MultiSelectPopover({
  label,
  placeholder,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  placeholder: string;
  options: FilterOption[];
  value: string[] | null;
  onChange: (value: string[] | null) => void;
  className?: string;
}) {
  const selected = value ?? [];
  const display =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? selected[0]
        : `${selected.length} selected`;

  const toggle = (optionValue: string) => {
    const next = selected.includes(optionValue)
      ? selected.filter((v) => v !== optionValue)
      : [...selected, optionValue];
    onChange(next.length ? next : null);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 min-w-[120px] justify-between gap-1 border-border/60 bg-background text-sm font-normal',
            className
          )}
        >
          <span className="truncate">{display}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">
          {label}
        </p>
        <div className="max-h-56 space-y-1 overflow-y-auto">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
            >
              <Checkbox
                checked={selected.includes(opt.value)}
                onCheckedChange={() => toggle(opt.value)}
              />
              <span className="truncate">{opt.label}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SingleSelectPopover({
  label,
  placeholder,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  placeholder: string;
  options: FilterOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  className?: string;
}) {
  const selectedOption = value ? options.find((o) => o.value === value) : null;
  const display = selectedOption ? selectedOption.label : placeholder;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 min-w-[120px] justify-between gap-1 border-border/60 bg-background text-sm font-normal',
            className
          )}
        >
          <span className="truncate">{display}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">
          {label}
        </p>
        <div className="max-h-56 space-y-0.5 overflow-y-auto">
          <button
            type="button"
            className={cn(
              'flex w-full cursor-pointer items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60',
              !value && 'bg-muted/50 font-medium'
            )}
            onClick={() => onChange(null)}
          >
            {placeholder}
          </button>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={cn(
                'flex w-full cursor-pointer items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60',
                value === opt.value && 'bg-muted/50 font-medium'
              )}
              onClick={() => onChange(opt.value)}
            >
              <span className="truncate">{opt.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const ValidationFilters = ({
  filters,
  onFiltersChange,
  spreadOptions,
  pageOptions,
  validationTypeOptions,
  dataIdOptions,
}: ValidationFiltersProps) => {
  const hasFilters =
    (filters.spreadId?.length ?? 0) > 0 ||
    (filters.pageId?.length ?? 0) > 0 ||
    (filters.validationType?.length ?? 0) > 0 ||
    !!filters.dataId;

  const clearFilters = () => {
    onFiltersChange({
      spreadId: null,
      pageId: null,
      validationType: null,
      dataId: null,
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
      <span className="text-xs font-medium text-muted-foreground">Filters</span>
      {spreadOptions.length > 0 && (
        <MultiSelectPopover
          label="Spread"
          placeholder="All spreads"
          options={spreadOptions}
          value={filters.spreadId}
          onChange={(v) => onFiltersChange({ ...filters, spreadId: v })}
        />
      )}
      {pageOptions.length > 0 && (
        <MultiSelectPopover
          label="Page"
          placeholder="All pages"
          options={pageOptions}
          value={filters.pageId}
          onChange={(v) => onFiltersChange({ ...filters, pageId: v })}
        />
      )}
      {validationTypeOptions.length > 0 && (
        <MultiSelectPopover
          label="Type"
          placeholder="All types"
          options={validationTypeOptions}
          value={filters.validationType}
          onChange={(v) =>
            onFiltersChange({
              ...filters,
              validationType: v as ('errors' | 'warnings' | 'infos')[] | null,
            })
          }
        />
      )}
      {dataIdOptions.length > 0 && (
        <SingleSelectPopover
          label="Data ID"
          placeholder="All data IDs"
          options={dataIdOptions}
          value={filters.dataId}
          onChange={(v) => onFiltersChange({ ...filters, dataId: v })}
        />
      )}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 px-2 text-muted-foreground hover:text-foreground"
          onClick={clearFilters}
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
};

export default ValidationFilters;
