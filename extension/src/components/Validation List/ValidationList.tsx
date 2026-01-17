import React, { useState, useEffect } from 'react';
import { Collapse, Empty, Typography } from 'antd';
import ValidationStats from '../Stat Group/StatGroup';
import { ValidationResult, ValidationCategory, CategoryDetail } from '../../types';
import ValidationTable from './ValidationTable/ValidationTable';
import ValidationCards from './ValidationCard/ValidationCard';
import ViewButtons from './ViewButtons';
import { isCategoryEmpty, filterByIdentifierDataId } from '../helpers';

const { Text } = Typography;


type ValidationListProps = {
  jsonResponse: ValidationResult;
  previousJsonResponse?: ValidationResult | null;
  checkerResponse: (jsonResponse: ValidationResult) => void;
  seeDetails?: Boolean;
};


function ValidationList({ jsonResponse, previousJsonResponse, checkerResponse, seeDetails }: ValidationListProps) {
  const [viewMode, setViewMode] = useState<'table' | 'card'>('card');
  const [selectedDataId, setSelectedDataId] = useState<string | null>(null);

  const { validation_classifiers } = jsonResponse;

  const defaultKeys: (keyof ValidationResult)[] = [
    'par_styles', 'char_styles', 'text_boxes', 'fonts', 'images', 'general'
  ];

  // Debug: Log whenever selectedDataId changes
  useEffect(() => {
    console.log('[Extension] selectedDataId state changed to:', selectedDataId);
  }, [selectedDataId]);

  // Listen for direct messages from background script when elements are selected on the page
  // This is much faster than storage polling - instant updates!
  useEffect(() => {
    console.log('[Extension] === Setting up runtime message listener ===');
    console.log('[Extension] Chrome API available:', typeof chrome !== 'undefined');
    console.log('[Extension] Chrome runtime available:', typeof chrome !== 'undefined' && chrome.runtime);

    // Listen for direct messages from background script
    const messageListener = (message: any, sender: any, sendResponse: any) => {
      if (message.action === 'selectedDataIdChanged') {
        const newDataId = message.dataId;
        console.log('[Extension] *** DIRECT MESSAGE RECEIVED *** new selected data-id:', newDataId);
        // Handle both null and undefined explicitly to ensure deselection works
        if (newDataId !== null && newDataId !== undefined) {
          setSelectedDataId(newDataId);
          console.log('[Extension] Updated selectedDataId state to:', newDataId);
        } else {
          setSelectedDataId(null);
          console.log('[Extension] Cleared selectedDataId - showing all results');
        }
        sendResponse({ success: true });
        return true; // Keep message channel open for async response
      }
      return false;
    };

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(messageListener);
      console.log('[Extension] Runtime message listener added');
    } else {
      console.error('[Extension] Cannot add runtime message listener - API not available');
    }

    return () => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.removeListener(messageListener);
      }
    };
  }, []); // Empty dependency array - only run once on mount

  const renderCategoryData = () => {
    const panels = defaultKeys.map((key) => {
      const categoryEnum = ValidationCategory[key as keyof typeof ValidationCategory];
      const categoryData = jsonResponse[key as keyof typeof jsonResponse] as CategoryDetail;

      if (!categoryData) return null; // Ensure categoryData is defined

      // Filter by selected data-id if one is selected
      const filteredDetails = selectedDataId
        ? filterByIdentifierDataId(categoryData.details, selectedDataId)
        : categoryData.details;

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
              {viewMode === 'card' ? (
                <ValidationCards
                  identifierData={filteredDetails}
                  category={categoryEnum}
                  textBoxData={jsonResponse.text_box_data}
                  validationClassifiers={validation_classifiers}
                  selectedDataId={selectedDataId}
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
        </Collapse.Panel>
      );
    }).filter(Boolean); // Remove null entries

    return panels;
  };

  // Check if we should show the empty state
  const categoryPanels = renderCategoryData();
  const shouldShowEmptyState = selectedDataId && categoryPanels.length === 0;

  // Get active keys for accordion - ensure all panels are open by default
  const computedActiveKeys = shouldShowEmptyState
    ? ['no-issues']
    : categoryPanels.map(panel => panel?.key).filter(Boolean) as string[];

  // Use state to control active keys so it updates when computedActiveKeys changes
  const [activeKeys, setActiveKeys] = useState<string[]>(computedActiveKeys);

  // Update activeKeys when selectedDataId changes
  // This ensures all results are shown when an item is deselected (selectedDataId becomes null)
  useEffect(() => {
    if (shouldShowEmptyState) {
      setActiveKeys(['no-issues']);
    } else {
      // Show all available category panels when no selection or when showing all results
      const newActiveKeys = categoryPanels.map(panel => panel?.key).filter(Boolean) as string[];
      setActiveKeys(newActiveKeys);
    }
  }, [selectedDataId]); // Update whenever selection changes - when deselected (null), all results show

  return (
    <div style={{ width: '100%', height: '100%' }} >
      <div style={{ backgroundColor: "#EAEBEB", display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ flexShrink: 0, position: 'relative', zIndex: 1 }}>
          <ValidationStats jsonResponse={jsonResponse} checkerResponse={checkerResponse} previousJsonResponse={previousJsonResponse} seeDetails={seeDetails} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px', marginBottom: '-40px', marginRight: '4%', position: 'relative', zIndex: 100 }}>
            <div style={{ marginRight: '10px', zIndex: '999' }}>
              {/* <CopyAll jsonResponse={jsonResponse}/> */}
            </div>
            <ViewButtons viewMode={viewMode} setViewMode={setViewMode} />
          </div>
        </div>
        <div style={{ flexShrink: 0, marginTop: 0, paddingTop: '50px', position: 'relative', zIndex: 1 }}>
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
                          The selected element (data-id: {selectedDataId}) has no validation issues.
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
