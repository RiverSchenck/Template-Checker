import React, { useState, useEffect, useMemo } from 'react';
import { Collapse, Empty, Typography } from 'antd';
import ValidationStats from '../Stat Group/StatGroup';
import { ValidationResult, ValidationCategory, CategoryDetail, ValidationItem } from '../../types';
import ValidationCards from './ValidationCard/ValidationCard';
import ValidationFilters, { FilterState } from './ValidationFilters';
import { isCategoryEmpty, filterByIdentifierDataId, filterByIdentifierFilters } from '../helpers';
import { highlightFilteredIssues, clearFilterHighlights } from '../../utils/messageUtils';

const { Text } = Typography;


type ValidationListProps = {
  jsonResponse: ValidationResult;
  previousJsonResponse?: ValidationResult | null;
  checkerResponse: (jsonResponse: ValidationResult) => void;
  seeDetails?: Boolean;
};


function ValidationList({ jsonResponse, previousJsonResponse, checkerResponse, seeDetails }: ValidationListProps) {
  const [filters, setFilters] = useState<FilterState>({
    spreadId: null,
    pageId: null,
    validationType: null,
    dataId: null,
  });
  const [highlightEnabled, setHighlightEnabled] = useState<boolean>(false);

  const { validation_classifiers, spread_to_pages, pages } = jsonResponse;

  // Clear page filter if selected pages are not in selected spreads
  useEffect(() => {
    if (filters.spreadId && filters.spreadId.length > 0 && filters.pageId && filters.pageId.length > 0) {
      // Get all pages that are in any of the selected spreads
      const validPages = new Set<string>();
      filters.spreadId.forEach(spreadId => {
        const pagesInSpread = spread_to_pages[spreadId] || [];
        pagesInSpread.forEach(pageId => validPages.add(pageId));
      });

      // Filter out pages that aren't in any selected spread
      const validPageIds = filters.pageId.filter(pageId => validPages.has(pageId));
      if (validPageIds.length !== filters.pageId.length) {
        setFilters(prev => ({ ...prev, pageId: validPageIds.length > 0 ? validPageIds : null }));
      }
    }
  }, [filters.spreadId, filters.pageId, spread_to_pages]);

  // Memoize defaultKeys to prevent unnecessary re-renders
  const defaultKeys: (keyof ValidationResult)[] = useMemo(() => [
    'par_styles', 'char_styles', 'text_boxes', 'fonts', 'images', 'general'
  ], []);

  // Get available items based on current filters (for smart filtering)
  const getAvailableItems = useMemo(() => {
    const allItems: ValidationItem[] = [];

    // Collect all validation items from all categories
    defaultKeys.forEach(key => {
      const categoryData = jsonResponse[key as keyof typeof jsonResponse] as CategoryDetail;
      if (categoryData?.details) {
        // Apply filters to get available items (excluding validationType for smart filtering)
        const tempFilters = { ...filters, validationType: null };
        let filteredDetails = filterByIdentifierFilters(categoryData.details, tempFilters);

        Object.values(filteredDetails).forEach(entries => {
          allItems.push(...entries.errors, ...entries.warnings, ...entries.infos);
        });
      }
    });

    return allItems;
  }, [jsonResponse, filters]);

  // Build smart filter options based on current filters
  const filterOptions = useMemo(() => {
    // Get unique spreads with numbering (from all available items)
    const spreadSet = new Set<string>();
    getAvailableItems.forEach(item => {
      if (item.spread_id) {
        spreadSet.add(item.spread_id);
      }
    });

    const spreadOptions: Array<{ value: string; label: string }> = [];
    Object.keys(spread_to_pages).forEach((spreadId, index) => {
      // Only include spreads that have items
      if (spreadSet.has(spreadId)) {
        spreadOptions.push({
          value: spreadId,
          label: `Spread ${index + 1}`
        });
      }
    });

    // Get pages - if spreads are selected, only show pages from those spreads
    let availablePages = getAvailableItems;
    if (filters.spreadId && filters.spreadId.length > 0) {
      // Filter items to only those from the selected spreads
      availablePages = getAvailableItems.filter(item => filters.spreadId!.includes(item.spread_id));
    }

    const pageSet = new Set<string>();
    availablePages.forEach(item => {
      if (item.page_id) {
        pageSet.add(item.page_id);
      }
    });

    const pageOptions: Array<{ value: string; label: string }> = Array.from(pageSet)
      .map(pageId => ({
        value: pageId,
        label: pages[pageId] || pageId
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    // Get data_id options - filter based on current spread/page filters
    let availableDataIds = getAvailableItems;
    if (filters.spreadId && filters.spreadId.length > 0) {
      availableDataIds = availableDataIds.filter(item => filters.spreadId!.includes(item.spread_id));
    }
    if (filters.pageId && filters.pageId.length > 0) {
      availableDataIds = availableDataIds.filter(item => filters.pageId!.includes(item.page_id));
    }

    const dataIdSet = new Set<string>();
    availableDataIds.forEach(item => {
      if (item.data_id && item.data_id !== 'null') {
        dataIdSet.add(item.data_id);
      }
    });

    const dataIdOptions: Array<{ value: string; label: string }> = Array.from(dataIdSet)
      .map(dataId => ({
        value: dataId,
        label: dataId
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    // Get validation types that have results (based on current filters excluding validationType)
    const tempFilters = { ...filters, validationType: null };

    // Check if any category has items of each type after applying current filters
    const checkTypeExists = (type: 'errors' | 'warnings' | 'infos') => {
      return defaultKeys.some(key => {
        const categoryData = jsonResponse[key as keyof typeof jsonResponse] as CategoryDetail;
        if (!categoryData?.details) return false;

        // tempFilters already includes dataId, so we just use it directly
        const filteredDetails = filterByIdentifierFilters(categoryData.details, tempFilters);

        return Object.values(filteredDetails).some(entries => entries[type].length > 0);
      });
    };

    const validationTypeOptions: Array<{ value: string; label: string }> = [];
    if (checkTypeExists('errors')) {
      validationTypeOptions.push({ value: 'errors', label: 'Errors' });
    }
    if (checkTypeExists('warnings')) {
      validationTypeOptions.push({ value: 'warnings', label: 'Warnings' });
    }
    if (checkTypeExists('infos')) {
      validationTypeOptions.push({ value: 'infos', label: 'Infos' });
    }

    return { spreadOptions, pageOptions, validationTypeOptions, dataIdOptions };
  }, [jsonResponse, spread_to_pages, pages, filters, getAvailableItems]);

  // Listen for direct messages from background script when elements are selected on the page
  // This is much faster than storage polling - instant updates!
  useEffect(() => {
    // Only log once on mount to reduce console spam
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      console.log('[Extension] Setting up runtime message listener');
    } else {
      console.error('[Extension] Cannot add runtime message listener - API not available');
    }

    // Listen for direct messages from background script
    const messageListener = (message: any, sender: any, sendResponse: any) => {
      if (message.action === 'selectedDataIdChanged') {
        const newDataId = message.dataId;
        console.log('[Extension] *** DIRECT MESSAGE RECEIVED *** new selected data-id:', newDataId);

        if (newDataId !== null && newDataId !== undefined) {
          // Find ALL validation items with this data_id to check if they share the same spread/page
          const matchingItems: ValidationItem[] = [];

          // Search through all categories to find all items with matching data_id
          defaultKeys.forEach(key => {
            const categoryData = jsonResponse[key as keyof typeof jsonResponse] as CategoryDetail;
            if (categoryData?.details) {
              Object.values(categoryData.details).forEach(entries => {
                // Check errors, warnings, and infos
                const allItems = [...entries.errors, ...entries.warnings, ...entries.infos];
                const itemsWithDataId = allItems.filter(item => item.data_id === newDataId);
                matchingItems.push(...itemsWithDataId);
              });
            }
          });

          // Collect all unique spread_ids and page_ids from matching items
          const spreadIds = new Set<string>();
          const pageIds = new Set<string>();

          matchingItems.forEach(item => {
            if (item.spread_id) spreadIds.add(item.spread_id);
            if (item.page_id) pageIds.add(item.page_id);
          });

          // Set all unique spreads and pages (multi-select)
          const foundSpreadIds = spreadIds.size > 0 ? Array.from(spreadIds) : null;
          const foundPageIds = pageIds.size > 0 ? Array.from(pageIds) : null;

          // Clear previous filters and set only the filters for the selected item
          setFilters({
            spreadId: foundSpreadIds,
            pageId: foundPageIds,
            validationType: null, // Clear validation type filter
            dataId: newDataId
          });
          console.log('[Extension] Updated filters:', {
            spreadId: foundSpreadIds,
            pageId: foundPageIds,
            dataId: newDataId,
            matchingItemsCount: matchingItems.length
          });
        } else {
          // Clear all filters when deselected
          setFilters(prev => ({ ...prev, dataId: null }));
          console.log('[Extension] Cleared filters.dataId - showing all results');
        }
        sendResponse({ success: true });
        return true; // Keep message channel open for async response
      }

      if (message.action === 'selectedSpreadChanged') {
        const newSpreadId = message.spreadId;
        console.log('[Extension] *** SPREAD SELECTED *** spread-id:', newSpreadId);

        if (newSpreadId !== null && newSpreadId !== undefined) {
          // Clear previous filters and set only the spread filter
          setFilters({
            spreadId: [newSpreadId],
            pageId: null, // Clear page filter - let user select specific pages if needed
            validationType: null, // Clear validation type filter
            dataId: null // Clear data_id filter
          });
          console.log('[Extension] Updated filters for spread:', {
            spreadId: [newSpreadId],
            pageId: null,
            validationType: null,
            dataId: null
          });
        }
        sendResponse({ success: true });
        return true; // Keep message channel open for async response
      }

      return false;
    };

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(messageListener);
    }

    return () => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.removeListener(messageListener);
      }
    };
  }, [jsonResponse, defaultKeys]); // Include jsonResponse and defaultKeys as dependencies

  // Handle highlighting based on filters
  useEffect(() => {
    console.log('[Extension] Highlight effect triggered:', { highlightEnabled, filtersCount: Object.keys(filters).length });

    // Debounce to prevent rapid re-highlighting
    const timeoutId = setTimeout(async () => {
      console.log('[Extension] Highlight toggle changed:', highlightEnabled);

      if (!highlightEnabled) {
        // Clear highlights when disabled
        console.log('[Extension] Clearing filter highlights');
        try {
          await clearFilterHighlights();
          console.log('[Extension] Successfully cleared filter highlights');
        } catch (error) {
          console.error('[Extension] Error clearing filter highlights:', error);
        }
        return;
      }

      // Collect all filtered validation items grouped by type
      const errorDataIds = new Set<string>();
      const warningDataIds = new Set<string>();
      const infoDataIds = new Set<string>();

      defaultKeys.forEach(key => {
        const categoryData = jsonResponse[key as keyof typeof jsonResponse] as CategoryDetail;
        if (categoryData?.details) {
          const filteredDetails = filterByIdentifierFilters(categoryData.details, filters);
          Object.values(filteredDetails).forEach(entries => {
            entries.errors.forEach(item => {
              if (item.data_id && item.data_id !== 'null') {
                errorDataIds.add(item.data_id);
              }
            });
            entries.warnings.forEach(item => {
              if (item.data_id && item.data_id !== 'null') {
                warningDataIds.add(item.data_id);
              }
            });
            entries.infos.forEach(item => {
              if (item.data_id && item.data_id !== 'null') {
                infoDataIds.add(item.data_id);
              }
            });
          });
        }
      });

      // Send highlighting message to content script
      console.log('[Extension] Sending highlight message:', {
        errors: errorDataIds.size,
        warnings: warningDataIds.size,
        infos: infoDataIds.size,
        total: errorDataIds.size + warningDataIds.size + infoDataIds.size
      });

      if (errorDataIds.size === 0 && warningDataIds.size === 0 && infoDataIds.size === 0) {
        console.warn('[Extension] No items to highlight - check filters');
        return;
      }

      try {
        await highlightFilteredIssues(
          Array.from(errorDataIds),
          Array.from(warningDataIds),
          Array.from(infoDataIds)
        );
        console.log('[Extension] Successfully sent highlight message');
      } catch (error) {
        console.error('[Extension] Error sending highlight message:', error);
      }
    }, 150); // Debounce by 150ms

    return () => {
      clearTimeout(timeoutId);
    };
  }, [highlightEnabled, filters, jsonResponse, defaultKeys]);

  const renderCategoryData = () => {
    const panels = defaultKeys.map((key) => {
      const categoryEnum = ValidationCategory[key as keyof typeof ValidationCategory];
      const categoryData = jsonResponse[key as keyof typeof jsonResponse] as CategoryDetail;

      if (!categoryData) return null; // Ensure categoryData is defined

      // Apply all filters (spread, page, validation type, and data_id)
      const filteredDetails = filterByIdentifierFilters(categoryData.details, filters);

      const isEmpty = isCategoryEmpty(filteredDetails);
      if (isEmpty) return null; // Skip rendering if the category is empty (or filtered to empty)

      return (
        <Collapse.Panel
          header={
            <span>{categoryEnum}</span>
          }
          key={key}
        >
          <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <div style={{ width: '95%' }}>
              <ValidationCards
                identifierData={filteredDetails}
                category={categoryEnum}
                textBoxData={jsonResponse.text_box_data}
                validationClassifiers={validation_classifiers}
                selectedDataId={filters.dataId}
              />
            </div>
          </div>
        </Collapse.Panel>
      );
    }).filter(Boolean); // Remove null entries

    return panels;
  };

  // Check if we should show the empty state
  const categoryPanels = renderCategoryData();
  const shouldShowEmptyState = filters.dataId && categoryPanels.length === 0;

  // Get active keys for accordion - ensure all panels are open by default
  const computedActiveKeys = shouldShowEmptyState
    ? ['no-issues']
    : categoryPanels.map(panel => panel?.key).filter(Boolean) as string[];

  // Use state to control active keys so it updates when computedActiveKeys changes
  const [activeKeys, setActiveKeys] = useState<string[]>(computedActiveKeys);

  // Update activeKeys when filters change
  // This ensures all results are shown when filters are cleared
  useEffect(() => {
    if (shouldShowEmptyState) {
      setActiveKeys(['no-issues']);
    } else {
      // Show all available category panels when no selection or when showing all results
      const newActiveKeys = categoryPanels.map(panel => panel?.key).filter(Boolean) as string[];
      setActiveKeys(newActiveKeys);
    }
  }, [filters, shouldShowEmptyState, categoryPanels]); // Update whenever filters change

  return (
    <div style={{ width: '100%', height: '100%' }} >
      <div style={{ backgroundColor: "#EAEBEB", display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ flexShrink: 0, position: 'relative', zIndex: 1 }}>
          <ValidationStats jsonResponse={jsonResponse} checkerResponse={checkerResponse} previousJsonResponse={previousJsonResponse} seeDetails={seeDetails} />
        </div>
        <div style={{ flexShrink: 0, marginTop: 0, paddingTop: '20px', position: 'relative', zIndex: 1 }}>
          <ValidationFilters
            filters={filters}
            onFiltersChange={setFilters}
            spreadOptions={filterOptions.spreadOptions}
            pageOptions={filterOptions.pageOptions}
            validationTypeOptions={filterOptions.validationTypeOptions}
            dataIdOptions={filterOptions.dataIdOptions}
            highlightEnabled={highlightEnabled}
            onHighlightToggle={setHighlightEnabled}
          />
        </div>
        <div style={{ flexShrink: 0, marginTop: 0, paddingTop: '10px', position: 'relative', zIndex: 1 }}>
          <Collapse
            activeKey={activeKeys}
            onChange={(keys) => setActiveKeys(Array.isArray(keys) ? keys : [keys])}
            size='large'
            bordered={false}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              margin: 0,
              padding: 0,
            }}
          >
            {shouldShowEmptyState ? (
              <Collapse.Panel
                header={<span>No Issues</span>}
                key="no-issues"
                disabled={false}
                style={{ margin: 0, padding: 0 }}
              >
                <div style={{
                  padding: '20px 20px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  width: '100%',
                  marginTop: 0
                }}>
                  <Empty
                    description={
                      <div>
                        <Text strong style={{ fontSize: '16px' }}>
                          No issues found for selected item
                        </Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: '14px', marginTop: '8px', display: 'block' }}>
                          The selected element (data-id: {filters.dataId}) has no validation issues.
                        </Text>
                      </div>
                    }
                    style={{ margin: 0 }}
                  />
                </div>
              </Collapse.Panel>
            ) : (
              categoryPanels
            )}
          </Collapse>
        </div>
      </div>
    </div>
  );
};



export default ValidationList;
