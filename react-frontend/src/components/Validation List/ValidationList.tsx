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

type ValidationListProps = {
  jsonResponse: ValidationResult;
  previousJsonResponse?: ValidationResult | null;
  checkerResponse: (jsonResponse: ValidationResult) => void;
  seeDetails?: boolean;
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
}: ValidationListProps) {
  const [viewMode, setViewMode] = useState<'table' | 'card'>('card');
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
    if (next.dataId && !dataIdValues.has(next.dataId)) next = { ...next, dataId: null };
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
  }, [filters, filterOptions.spreadOptions, filterOptions.pageOptions, filterOptions.dataIdOptions, filterOptions.validationTypeOptions]);

  return (
    <div className="h-full w-full min-w-0 overflow-x-hidden">
      <div className="bg-muted/30 px-[4%]">
        <ValidationStats
          jsonResponse={jsonResponse}
          checkerResponse={checkerResponse}
          previousJsonResponse={previousJsonResponse}
          seeDetails={seeDetails}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pb-1.5">
          <ValidationFilters
            filters={filters}
            onFiltersChange={setFilters}
            spreadOptions={filterOptions.spreadOptions}
            pageOptions={filterOptions.pageOptions}
            validationTypeOptions={filterOptions.validationTypeOptions}
            dataIdOptions={filterOptions.dataIdOptions}
          />
          <ViewButtons viewMode={viewMode} setViewMode={setViewMode} />
        </div>
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
                        />
                      ) : (
                        <ValidationTable
                          identifierData={filteredDetails}
                          category={categoryEnum}
                          textBoxData={jsonResponse.text_box_data}
                          validationClassifiers={validation_classifiers}
                        />
                      )}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </div>
  );
}

export default ValidationList;
