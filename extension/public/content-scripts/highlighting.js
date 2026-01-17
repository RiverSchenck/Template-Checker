// Highlighting functionality for elements by data-id

let highlightState = {
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
}
