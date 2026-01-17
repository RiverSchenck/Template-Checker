// Highlighting functionality for elements by data-id

let highlightState = {
  highlightedElements: [],
  originalOutlines: new Map(),
  originalBackgrounds: new Map()
};

let filterHighlightState = {
  highlightedElements: [],
  originalOutlines: new Map(),
  originalBackgrounds: new Map()
};

function clearHighlights() {
  highlightState.highlightedElements.forEach(element => {
    const originalOutline = highlightState.originalOutlines.get(element);
    const originalBackground = highlightState.originalBackgrounds.get(element);

    if (originalOutline !== undefined) {
      element.style.outline = originalOutline;
    }
    if (originalBackground !== undefined) {
      element.style.backgroundColor = originalBackground;
    }
  });

  highlightState.highlightedElements = [];
  highlightState.originalOutlines.clear();
  highlightState.originalBackgrounds.clear();
}

function clearFilterHighlights() {
  filterHighlightState.highlightedElements.forEach(element => {
    const originalOutline = filterHighlightState.originalOutlines.get(element);
    const originalBackground = filterHighlightState.originalBackgrounds.get(element);

    if (originalOutline !== undefined) {
      element.style.outline = originalOutline;
    }
    if (originalBackground !== undefined) {
      element.style.backgroundColor = originalBackground;
    }
    element.removeAttribute('data-filter-highlight-type');
  });

  filterHighlightState.highlightedElements = [];
  filterHighlightState.originalOutlines.clear();
  filterHighlightState.originalBackgrounds.clear();
}

function highlightFilteredIssues(errorDataIds, warningDataIds, infoDataIds) {
  // Clear previous filter highlights
  clearFilterHighlights();

  // Use a Set to track which elements we've already processed to prevent duplicates
  const processedElements = new Set();

  // Color scheme: errors = red, warnings = orange/yellow, infos = blue
  const errorColor = '#ff4d4f'; // Red
  const warningColor = '#faad14'; // Orange/Yellow
  const infoColor = '#1890ff'; // Blue

  // Highlight errors
  errorDataIds.forEach(dataId => {
    const selector = `[data-id="${dataId}"]`;
    const elements = document.querySelectorAll(selector);
    elements.forEach(element => {
      // Skip if already processed
      if (processedElements.has(element)) {
        return;
      }

      // Store original styles only once
      if (!filterHighlightState.originalOutlines.has(element)) {
        filterHighlightState.originalOutlines.set(element, element.style.outline || '');
        filterHighlightState.originalBackgrounds.set(element, element.style.backgroundColor || '');
      }

      // Apply error highlighting
      element.style.outline = `3px solid ${errorColor}`;
      element.style.outlineOffset = '2px';
      element.style.backgroundColor = 'rgba(255, 77, 79, 0.15)';
      element.style.transition = 'all 0.3s ease';
      element.setAttribute('data-filter-highlight-type', 'error');

      // Mark as processed and add to highlighted elements
      processedElements.add(element);
      filterHighlightState.highlightedElements.push(element);
    });
  });

  // Highlight warnings (only if not already highlighted as error)
  warningDataIds.forEach(dataId => {
    const selector = `[data-id="${dataId}"]`;
    const elements = document.querySelectorAll(selector);
    elements.forEach(element => {
      // Skip if already processed
      if (processedElements.has(element)) {
        return;
      }

      // Store original styles only once
      if (!filterHighlightState.originalOutlines.has(element)) {
        filterHighlightState.originalOutlines.set(element, element.style.outline || '');
        filterHighlightState.originalBackgrounds.set(element, element.style.backgroundColor || '');
      }

      // Apply warning highlighting
      element.style.outline = `3px solid ${warningColor}`;
      element.style.outlineOffset = '2px';
      element.style.backgroundColor = 'rgba(250, 173, 20, 0.15)';
      element.style.transition = 'all 0.3s ease';
      element.setAttribute('data-filter-highlight-type', 'warning');

      // Mark as processed and add to highlighted elements
      processedElements.add(element);
      filterHighlightState.highlightedElements.push(element);
    });
  });

  // Highlight infos (only if not already highlighted as error or warning)
  infoDataIds.forEach(dataId => {
    const selector = `[data-id="${dataId}"]`;
    const elements = document.querySelectorAll(selector);
    elements.forEach(element => {
      // Skip if already processed
      if (processedElements.has(element)) {
        return;
      }

      // Store original styles only once
      if (!filterHighlightState.originalOutlines.has(element)) {
        filterHighlightState.originalOutlines.set(element, element.style.outline || '');
        filterHighlightState.originalBackgrounds.set(element, element.style.backgroundColor || '');
      }

      // Apply info highlighting
      element.style.outline = `3px solid ${infoColor}`;
      element.style.outlineOffset = '2px';
      element.style.backgroundColor = 'rgba(24, 144, 255, 0.15)';
      element.style.transition = 'all 0.3s ease';
      element.setAttribute('data-filter-highlight-type', 'info');

      // Mark as processed and add to highlighted elements
      processedElements.add(element);
      filterHighlightState.highlightedElements.push(element);
    });
  });
}

function highlightElements(dataId) {
  clearHighlights();

  if (!dataId) {
    return;
  }

  const selector = `[data-id="${dataId}"]`;
  const elements = document.querySelectorAll(selector);

  if (elements.length === 0) {
    return;
  }

  elements.forEach(element => {
    highlightState.originalOutlines.set(element, element.style.outline);
    highlightState.originalBackgrounds.set(element, element.style.backgroundColor);

    element.style.outline = '3px solid #B39DFD';
    element.style.outlineOffset = '2px';
    element.style.backgroundColor = 'rgba(179, 157, 253, 0.2)';
    element.style.transition = 'all 0.3s ease';

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    highlightState.highlightedElements.push(element);
  });
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.highlightElements = highlightElements;
  window.clearHighlights = clearHighlights;
  window.highlightFilteredIssues = highlightFilteredIssues;
  window.clearFilterHighlights = clearFilterHighlights;
  console.log('[Content Script] Highlighting functions exported to window:', {
    highlightElements: typeof window.highlightElements,
    clearHighlights: typeof window.clearHighlights,
    highlightFilteredIssues: typeof window.highlightFilteredIssues,
    clearFilterHighlights: typeof window.clearFilterHighlights
  });
}
