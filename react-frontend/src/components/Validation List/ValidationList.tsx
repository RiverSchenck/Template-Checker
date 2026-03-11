import React, { useState, useMemo, useEffect } from 'react';
import { ValidationResult, ValidationCategory, CategoryDetail, ValidationItem } from '../../types';
import ValidationStats from '../Stat Group/StatGroup';
import ValidationTable from './ValidationTable/ValidationTable';
import ValidationCards from './ValidationCard/ValidationCard';
import ViewButtons from './ViewButtons';
import ValidationFilters from './ValidationFilters';
import { isCategoryEmpty, filterByIdentifierFilters, type ValidationFilterState } from '../helpers';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../ui/accordion';
import { Card, CardContent } from '../ui/card';
import { Switch } from '../ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { CircleCheck, Sparkles } from 'lucide-react';
import {
  notifyExtensionToHighlightFiltered,
  notifyExtensionToClearFilterHighlights,
} from '../../utils/extensionHighlight';

type ValidationListProps = {
  jsonResponse: ValidationResult;
  previousJsonResponse?: ValidationResult | null;
  checkerResponse: (jsonResponse: ValidationResult) => void;
  seeDetails?: boolean;
  fromExtension?: boolean;
  extensionVersion?: string | null;
};

const defaultKeys: (keyof ValidationResult)[] = [
  'par_styles',
  'char_styles',
  'text_boxes',
  'fonts',
  'images',
  'general',
];

function ValidationList({
  jsonResponse,
  previousJsonResponse,
  checkerResponse,
  seeDetails,
  fromExtension = false,
  extensionVersion = null,
}: ValidationListProps) {
  const [viewMode, setViewMode] = useState<'table' | 'card'>('card');
  const [highlightIssuesOn, setHighlightIssuesOn] = useState(false);
  const [filters, setFilters] = useState<ValidationFilterState>({
    spreadId: null,
    pageId: null,
    validationType: null,
    dataId: null,
  });

  const { validation_classifiers, spread_to_pages, pages } = jsonResponse;

  // Keep page filter in sync when spread filter changes
  useEffect(() => {
    if (!filters.spreadId?.length || !filters.pageId?.length) return;
    const validPages = new Set<string>();
    filters.spreadId.forEach((spreadId) => {
      (spread_to_pages[spreadId] ?? []).forEach((pageId) => validPages.add(pageId));
    });
    const validPageIds = filters.pageId.filter((id) => validPages.has(id));
    if (validPageIds.length !== filters.pageId.length) {
      setFilters((prev) => ({ ...prev, pageId: validPageIds.length ? validPageIds : null }));
    }
  }, [filters.spreadId, filters.pageId, spread_to_pages]);

  // When extension user selects a spread in Frontify, filter the UI to that spread
  useEffect(() => {
    if (!fromExtension) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== 'TEMPLATE_CHECKER_SPREAD_FILTER') return;
      const spreadId = event.data.spreadId;
      setFilters((prev) => ({
        ...prev,
        spreadId: spreadId && Object.prototype.hasOwnProperty.call(spread_to_pages, spreadId) ? [spreadId] : null,
      }));
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [fromExtension, spread_to_pages]);

  // When extension user selects an element in Frontify (by data-id), filter the UI to that data id
  useEffect(() => {
    if (!fromExtension) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== 'TEMPLATE_CHECKER_DATA_ID_FILTER') return;
      const dataId = event.data.dataId;
      setFilters((prev) => ({
        ...prev,
        dataId: dataId && typeof dataId === 'string' ? dataId : null,
      }));
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [fromExtension]);

  // Build filter options so each dropdown only shows values that still have results
  // when combined with the other current selections (no option that would yield zero items).
  const filterOptions = useMemo(() => {
    const collectItems = (filtersOverride: Partial<ValidationFilterState>) => {
      const combined = { ...filters, ...filtersOverride, validationType: null };
      const allItems: ValidationItem[] = [];
      defaultKeys.forEach((key) => {
        const categoryData = jsonResponse[key as keyof typeof jsonResponse] as CategoryDetail;
        if (categoryData?.details) {
          const filteredDetails = filterByIdentifierFilters(categoryData.details, combined as ValidationFilterState);
          Object.values(filteredDetails).forEach((entries) => {
            allItems.push(...entries.errors, ...entries.warnings, ...entries.infos);
          });
        }
      });
      return allItems;
    };

    // Spread options: only spreads that have at least one item given current page + dataId (ignore spreadId)
    const itemsForSpread = collectItems({ spreadId: null });
    const spreadSet = new Set<string>();
    itemsForSpread.forEach((item) => item.spread_id && spreadSet.add(item.spread_id));
    const spreadOptions: { value: string; label: string }[] = [];
    Object.keys(spread_to_pages).forEach((spreadId, index) => {
      if (spreadSet.has(spreadId)) {
        spreadOptions.push({ value: spreadId, label: `Spread ${index + 1}` });
      }
    });

    // Page options: only pages that have items given current spread + dataId (ignore pageId)
    const itemsForPage = collectItems({ pageId: null });
    let pageCandidates = itemsForPage;
    if (filters.spreadId?.length) {
      pageCandidates = itemsForPage.filter((item) => filters.spreadId!.includes(item.spread_id));
    }
    const pageSet = new Set<string>();
    pageCandidates.forEach((item) => item.page_id && pageSet.add(item.page_id));
    const pageOptions = Array.from(pageSet)
      .map((pageId) => ({ value: pageId, label: pages[pageId] || pageId }))
      .sort((a, b) => a.label.localeCompare(b.label));

    // Data ID options: only data IDs that have items given current spread + page (ignore dataId)
    const itemsForDataId = collectItems({ dataId: null });
    let dataIdCandidates = itemsForDataId;
    if (filters.spreadId?.length) {
      dataIdCandidates = dataIdCandidates.filter((item) => filters.spreadId!.includes(item.spread_id));
    }
    if (filters.pageId?.length) {
      dataIdCandidates = dataIdCandidates.filter((item) => filters.pageId!.includes(item.page_id));
    }
    const dataIdSet = new Set<string>();
    dataIdCandidates.forEach((item) => {
      if (item.data_id && item.data_id !== 'null') dataIdSet.add(item.data_id);
    });
    const dataIdOptions = Array.from(dataIdSet)
      .map((dataId) => ({ value: dataId, label: dataId }))
      .sort((a, b) => a.label.localeCompare(b.label));

    // Type options: only types that have items given current spread + page + dataId
    const validationTypeOptions: { value: string; label: string }[] = [];
    const typeSet = new Set<string>();
    defaultKeys.forEach((key) => {
      const categoryData = jsonResponse[key as keyof typeof jsonResponse] as CategoryDetail;
      if (!categoryData?.details) return;
      const filteredDetails = filterByIdentifierFilters(categoryData.details, filters);
      Object.values(filteredDetails).forEach((entries) => {
        if (entries.errors.length) typeSet.add('errors');
        if (entries.warnings.length) typeSet.add('warnings');
        if (entries.infos.length) typeSet.add('infos');
      });
    });
    if (typeSet.has('errors')) validationTypeOptions.push({ value: 'errors', label: 'Errors' });
    if (typeSet.has('warnings')) validationTypeOptions.push({ value: 'warnings', label: 'Warnings' });
    if (typeSet.has('infos')) validationTypeOptions.push({ value: 'infos', label: 'Infos' });

    return { spreadOptions, pageOptions, validationTypeOptions, dataIdOptions };
  }, [jsonResponse, spread_to_pages, pages, filters]);

  // Clear any selected filter value that is no longer in the options (e.g. after changing another filter)
  useEffect(() => {
    let next = { ...filters };
    const spreadValues = new Set(filterOptions.spreadOptions.map((o) => o.value));
    const pageValues = new Set(filterOptions.pageOptions.map((o) => o.value));
    const dataIdValues = new Set(filterOptions.dataIdOptions.map((o) => o.value));
    const typeValues = new Set(filterOptions.validationTypeOptions.map((o) => o.value));

    if (next.spreadId?.length) {
      const valid = next.spreadId.filter((id) => spreadValues.has(id));
      if (valid.length !== next.spreadId.length) next = { ...next, spreadId: valid.length ? valid : null };
    }
    if (next.pageId?.length) {
      const valid = next.pageId.filter((id) => pageValues.has(id));
      if (valid.length !== next.pageId.length) next = { ...next, pageId: valid.length ? valid : null };
    }
    // When from extension, keep dataId even if not in options (e.g. selected element has no issues — we show empty state)
    if (next.dataId && !dataIdValues.has(next.dataId) && !fromExtension) next = { ...next, dataId: null };
    if (next.validationType?.length) {
      const valid = next.validationType.filter((t) => typeValues.has(t));
      if (valid.length !== next.validationType.length) {
        next = { ...next, validationType: valid.length ? valid : null };
      }
    }
    if (
      next.spreadId !== filters.spreadId ||
      next.pageId !== filters.pageId ||
      next.dataId !== filters.dataId ||
      next.validationType !== filters.validationType
    ) {
      setFilters(next);
    }
  }, [filters, filterOptions.spreadOptions, filterOptions.pageOptions, filterOptions.dataIdOptions, filterOptions.validationTypeOptions, fromExtension]);

  // When a data ID is selected (e.g. from Frontify) but has no issues, we have no categories to show
  const hasAnyFilteredItems = useMemo(() => {
    let count = 0;
    defaultKeys.forEach((key) => {
      const categoryData = jsonResponse[key as keyof typeof jsonResponse] as CategoryDetail;
      if (!categoryData?.details) return;
      const filteredDetails = filterByIdentifierFilters(categoryData.details, filters);
      Object.values(filteredDetails).forEach((entries) => {
        count += entries.errors.length + entries.warnings.length + entries.infos.length;
      });
    });
    return count > 0;
  }, [jsonResponse, filters]);

  const dataIdSelectedWithNoIssues = Boolean(fromExtension && filters.dataId && !hasAnyFilteredItems);

  // Data IDs for current filtered items, by type (for extension bulk highlight)
  const filteredHighlightDataIds = useMemo(() => {
    const errorIds = new Set<string>();
    const warningIds = new Set<string>();
    const infoIds = new Set<string>();
    defaultKeys.forEach((key) => {
      const categoryData = jsonResponse[key as keyof typeof jsonResponse] as CategoryDetail;
      if (!categoryData?.details) return;
      const filteredDetails = filterByIdentifierFilters(categoryData.details, filters);
      Object.values(filteredDetails).forEach((entries) => {
        entries.errors.forEach((item) => {
          if (item.data_id && item.data_id !== 'null') errorIds.add(item.data_id);
        });
        entries.warnings.forEach((item) => {
          if (item.data_id && item.data_id !== 'null') warningIds.add(item.data_id);
        });
        entries.infos.forEach((item) => {
          if (item.data_id && item.data_id !== 'null') infoIds.add(item.data_id);
        });
      });
    });
    return {
      errorDataIds: Array.from(errorIds),
      warningDataIds: Array.from(warningIds),
      infoDataIds: Array.from(infoIds),
    };
  }, [jsonResponse, filters]);

  const hasActiveFilters =
    (filters.spreadId?.length ?? 0) > 0 ||
    (filters.pageId?.length ?? 0) > 0 ||
    !!filters.dataId ||
    (filters.validationType?.length ?? 0) > 0;
  const highlightLabel = hasActiveFilters ? 'Highlight filtered issues' : 'Highlight issues';

  // Apply or clear bulk highlights when toggle or filters change
  useEffect(() => {
    if (!fromExtension) return;
    if (highlightIssuesOn) {
      notifyExtensionToHighlightFiltered(
        filteredHighlightDataIds.errorDataIds,
        filteredHighlightDataIds.warningDataIds,
        filteredHighlightDataIds.infoDataIds
      );
    } else {
      notifyExtensionToClearFilterHighlights();
    }
    return () => {
      notifyExtensionToClearFilterHighlights();
    };
  }, [fromExtension, highlightIssuesOn, filteredHighlightDataIds]);

  return (
    <div className="h-full w-full min-w-0 overflow-x-hidden">
      <div className="bg-muted/30 px-[4%]">
        <ValidationStats
          jsonResponse={jsonResponse}
          checkerResponse={checkerResponse}
          previousJsonResponse={previousJsonResponse}
          seeDetails={seeDetails}
        />
        <div className="mt-2 flex flex-wrap items-start justify-between gap-2 pb-1.5">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <ValidationFilters
              filters={filters}
              onFiltersChange={setFilters}
              spreadOptions={filterOptions.spreadOptions}
              pageOptions={filterOptions.pageOptions}
              validationTypeOptions={filterOptions.validationTypeOptions}
              dataIdOptions={filterOptions.dataIdOptions}
            />
            {fromExtension && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 shadow-sm transition-colors ${
                        highlightIssuesOn
                          ? 'border-violet-500/60 bg-violet-500/10 ring-1 ring-violet-500/30'
                          : 'border-violet-400/60 bg-violet-500/5 ring-1 ring-violet-400/20'
                      }`}
                    >
                      <label
                        className={`flex cursor-pointer items-center gap-2 text-sm ${
                          highlightIssuesOn ? 'text-violet-700 dark:text-violet-300' : 'text-violet-700/90 dark:text-violet-300/90'
                        }`}
                      >
                        <Sparkles
                          className={`h-4 w-4 ${
                            highlightIssuesOn
                              ? 'text-violet-600 dark:text-violet-300'
                              : 'text-violet-500 dark:text-violet-400'
                          }`}
                        />
                        <Switch
                          checked={highlightIssuesOn}
                          onCheckedChange={(checked) => setHighlightIssuesOn(checked === true)}
                          aria-describedby={hasActiveFilters ? 'highlight-filtered-desc' : undefined}
                        />
                        <span id={hasActiveFilters ? 'highlight-filtered-desc' : undefined}>
                          {highlightLabel}
                        </span>
                      </label>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    {hasActiveFilters
                      ? 'Highlight the currently filtered issues on the Frontify page (not all issues).'
                      : 'Highlight all issues on the Frontify page.'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="ml-auto shrink-0 self-start text-right">
            <ViewButtons viewMode={viewMode} setViewMode={setViewMode} />
            {fromExtension && (
              <div className="mt-1 inline-flex items-center gap-2 rounded-full border border-violet-400/40 bg-violet-500/10 px-2.5 py-1 text-[11px]">
                <span className="font-medium text-violet-700 dark:text-violet-300">Extension</span>
                <span className="font-mono text-violet-800 dark:text-violet-200">
                  {extensionVersion ? `v${extensionVersion}` : 'unknown'}
                </span>
              </div>
            )}
          </div>
        </div>
        {dataIdSelectedWithNoIssues ? (
          <Card className="border-l-4 border-l-emerald-500 bg-muted/20">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-10">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                <CircleCheck className="h-7 w-7 text-emerald-600 dark:text-emerald-400" aria-hidden />
              </div>
              <div className="text-center space-y-1">
                <p className="text-base font-semibold text-foreground">No validation issues</p>
                <p className="text-sm text-muted-foreground">Element <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{filters.dataId}</code> passed all checks.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
        <Accordion
          type="multiple"
          defaultValue={defaultKeys}
          className="w-full max-w-full border-0 bg-transparent"
        >
          {defaultKeys.map((key) => {
            const categoryEnum = ValidationCategory[key as keyof typeof ValidationCategory];
            const categoryData = jsonResponse[key as keyof typeof jsonResponse] as CategoryDetail;

            if (!categoryData) return null;
            const filteredDetails = filterByIdentifierFilters(categoryData.details, filters);
            if (isCategoryEmpty(filteredDetails)) return null;

            return (
              <AccordionItem key={key} value={key} className="border-b border-border/40">
                <AccordionTrigger className="px-0 py-4 text-left font-medium hover:no-underline">
                  {categoryEnum}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex w-full justify-center">
                    <div className="w-[95%]">
                      {viewMode === 'card' ? (
                        <ValidationCards
                          identifierData={filteredDetails}
                          category={categoryEnum}
                          textBoxData={jsonResponse.text_box_data}
                          validationClassifiers={validation_classifiers}
                          fromExtension={fromExtension}
                        />
                      ) : (
                        <ValidationTable
                          identifierData={filteredDetails}
                          category={categoryEnum}
                          textBoxData={jsonResponse.text_box_data}
                          validationClassifiers={validation_classifiers}
                          fromExtension={fromExtension}
                        />
                      )}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
        )}
      </div>
    </div>
  );
}

export default ValidationList;
