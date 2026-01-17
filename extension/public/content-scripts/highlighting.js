// Highlighting functionality for elements by data-id

let highlightState = {
  highlightedElements: [],
  originalOutlines: new Map(),
  originalBackgrounds: new Map(),
};

let filterHighlightState = {
  highlightedElements: [],
  originalOutlines: new Map(),
  originalBackgrounds: new Map(),
};

// Store original text nodes and highlight spans for cleanup
let textHighlightState = {
  highlightedSpans: [],
  originalTextNodes: new Map(),
};

function clearTextHighlights() {
  // Remove all highlighted spans and restore original text nodes
  textHighlightState.highlightedSpans.forEach((span) => {
    if (span.parentNode) {
      const parent = span.parentNode;
      const textNode = document.createTextNode(span.textContent);
      parent.replaceChild(textNode, span);

      // Normalize parent to merge adjacent text nodes
      parent.normalize();
    }
  });

  textHighlightState.highlightedSpans = [];
  textHighlightState.originalTextNodes.clear();
}

function clearHighlights() {
  // Clear text highlights first
  clearTextHighlights();

  highlightState.highlightedElements.forEach((element) => {
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
  filterHighlightState.highlightedElements.forEach((element) => {
    const originalOutline = filterHighlightState.originalOutlines.get(element);
    const originalBackground =
      filterHighlightState.originalBackgrounds.get(element);

    if (originalOutline !== undefined) {
      element.style.outline = originalOutline;
    }
    if (originalBackground !== undefined) {
      element.style.backgroundColor = originalBackground;
    }
    element.removeAttribute("data-filter-highlight-type");
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
  const errorColor = "#ff4d4f"; // Red
  const warningColor = "#faad14"; // Orange/Yellow
  const infoColor = "#1890ff"; // Blue

  // Highlight errors
  errorDataIds.forEach((dataId) => {
    // Only highlight elements that have both data-id and the o-canvas__item--selectable class
    const selector = `[data-id="${dataId}"].o-canvas__item--selectable`;
    const elements = document.querySelectorAll(selector);
    elements.forEach((element) => {
      // Skip if already processed
      if (processedElements.has(element)) {
        return;
      }

      // Store original styles only once
      if (!filterHighlightState.originalOutlines.has(element)) {
        filterHighlightState.originalOutlines.set(
          element,
          element.style.outline || ""
        );
        filterHighlightState.originalBackgrounds.set(
          element,
          element.style.backgroundColor || ""
        );
      }

      // Apply error highlighting
      element.style.outline = `3px solid ${errorColor}`;
      element.style.outlineOffset = "2px";
      element.style.backgroundColor = "rgba(255, 77, 79, 0.15)";
      element.style.transition = "all 0.3s ease";
      element.setAttribute("data-filter-highlight-type", "error");

      // Mark as processed and add to highlighted elements
      processedElements.add(element);
      filterHighlightState.highlightedElements.push(element);
    });
  });

  // Highlight warnings (only if not already highlighted as error)
  warningDataIds.forEach((dataId) => {
    // Only highlight elements that have both data-id and the o-canvas__item--selectable class
    const selector = `[data-id="${dataId}"].o-canvas__item--selectable`;
    const elements = document.querySelectorAll(selector);
    elements.forEach((element) => {
      // Skip if already processed
      if (processedElements.has(element)) {
        return;
      }

      // Store original styles only once
      if (!filterHighlightState.originalOutlines.has(element)) {
        filterHighlightState.originalOutlines.set(
          element,
          element.style.outline || ""
        );
        filterHighlightState.originalBackgrounds.set(
          element,
          element.style.backgroundColor || ""
        );
      }

      // Apply warning highlighting
      element.style.outline = `3px solid ${warningColor}`;
      element.style.outlineOffset = "2px";
      element.style.backgroundColor = "rgba(250, 173, 20, 0.15)";
      element.style.transition = "all 0.3s ease";
      element.setAttribute("data-filter-highlight-type", "warning");

      // Mark as processed and add to highlighted elements
      processedElements.add(element);
      filterHighlightState.highlightedElements.push(element);
    });
  });

  // Highlight infos (only if not already highlighted as error or warning)
  infoDataIds.forEach((dataId) => {
    // Only highlight elements that have both data-id and the o-canvas__item--selectable class
    const selector = `[data-id="${dataId}"].o-canvas__item--selectable`;
    const elements = document.querySelectorAll(selector);
    elements.forEach((element) => {
      // Skip if already processed
      if (processedElements.has(element)) {
        return;
      }

      // Store original styles only once
      if (!filterHighlightState.originalOutlines.has(element)) {
        filterHighlightState.originalOutlines.set(
          element,
          element.style.outline || ""
        );
        filterHighlightState.originalBackgrounds.set(
          element,
          element.style.backgroundColor || ""
        );
      }

      // Apply info highlighting
      element.style.outline = `3px solid ${infoColor}`;
      element.style.outlineOffset = "2px";
      element.style.backgroundColor = "rgba(24, 144, 255, 0.15)";
      element.style.transition = "all 0.3s ease";
      element.setAttribute("data-filter-highlight-type", "info");

      // Mark as processed and add to highlighted elements
      processedElements.add(element);
      filterHighlightState.highlightedElements.push(element);
    });
  });
}

function highlightTextWithinElement(
  element,
  textContentArray,
  highlightColor = "#000000",
  backgroundColor = "rgba(255, 255, 0, 0.6)"
) {
  if (!element || !textContentArray || textContentArray.length === 0) {
    return;
  }

  // Process each search text to find and highlight
  textContentArray.forEach((searchText) => {
    if (!searchText || searchText.trim().length === 0) {
      return;
    }

    // Try exact match first, then try with normalized whitespace
    const normalizeWhitespace = (text) => {
      if (!text) return "";
      return text.replace(/\s+/g, " ").trim();
    };

    // Use Range API to find and highlight text
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    const rangesToHighlight = [];
    let node;

    // Find all text nodes that contain the search text
    while ((node = walker.nextNode())) {
      const nodeText = node.textContent || "";

      // Try exact match first
      let searchIndex = 0;
      while (true) {
        const exactIndex = nodeText.indexOf(searchText, searchIndex);
        if (exactIndex === -1) {
          // Try normalized match if exact match fails
          const normalizedNodeText = normalizeWhitespace(nodeText);
          const normalizedSearchText = normalizeWhitespace(searchText);

          if (
            normalizedSearchText &&
            normalizedNodeText.includes(normalizedSearchText)
          ) {
            // Find approximate position in original text
            // For now, just try to find a substring match
            const nodeTextLower = nodeText.toLowerCase();
            const searchTextLower = searchText.toLowerCase();
            const fuzzyIndex = nodeTextLower.indexOf(
              searchTextLower,
              searchIndex
            );

            if (fuzzyIndex !== -1) {
              try {
                const range = document.createRange();
                range.setStart(node, fuzzyIndex);
                range.setEnd(node, fuzzyIndex + searchText.length);
                rangesToHighlight.push(range.cloneRange());
                searchIndex = fuzzyIndex + 1;
                continue;
              } catch (e) {
                console.warn("Error creating range for normalized match:", e);
              }
            }
          }
          break;
        }

        // Create range for exact match
        try {
          const range = document.createRange();
          range.setStart(node, exactIndex);
          range.setEnd(node, exactIndex + searchText.length);
          rangesToHighlight.push(range.cloneRange());
        } catch (e) {
          console.warn("Error creating range for exact match:", e);
        }

        searchIndex = exactIndex + 1;
      }
    }

    // Highlight ranges (in reverse order to preserve positions)
    rangesToHighlight.reverse().forEach((range) => {
      try {
        // Check if range is valid
        if (range.collapsed) {
          return;
        }

        // Create highlight span - use minimal styling to avoid changing formatting
        const highlightSpan = document.createElement("span");
        highlightSpan.style.backgroundColor = backgroundColor;
        // Don't change color, font-weight, padding, or other properties that affect layout
        highlightSpan.style.display = "inline";
        highlightSpan.style.lineHeight = "inherit";
        highlightSpan.style.fontSize = "inherit";
        highlightSpan.style.fontWeight = "inherit";
        highlightSpan.style.margin = "0";
        highlightSpan.style.padding = "0";
        highlightSpan.setAttribute("data-highlighted-text", "true");

        // Extract content and wrap it
        const contents = range.extractContents();
        highlightSpan.appendChild(contents);
        range.insertNode(highlightSpan);

        textHighlightState.highlightedSpans.push(highlightSpan);
      } catch (e) {
        console.warn("Error highlighting range:", e);
      }
    });
  });
}

function highlightElements(dataId, textContentArray = null) {
  clearHighlights();

  if (!dataId) {
    return;
  }

  // Only highlight elements that have both data-id and the o-canvas__item--selectable class
  const selector = `[data-id="${dataId}"].o-canvas__item--selectable`;
  const elements = document.querySelectorAll(selector);

  if (elements.length === 0) {
    return;
  }

  elements.forEach((element) => {
    highlightState.originalOutlines.set(element, element.style.outline);
    highlightState.originalBackgrounds.set(
      element,
      element.style.backgroundColor
    );

    // If text_content array is provided, highlight specific text within the element
    if (
      textContentArray &&
      Array.isArray(textContentArray) &&
      textContentArray.length > 0
    ) {
      highlightTextWithinElement(element, textContentArray);
    }

    element.style.outline = "3px solid #B39DFD";
    element.style.outlineOffset = "2px";
    element.style.backgroundColor = "rgba(179, 157, 253, 0.2)";
    element.style.transition = "all 0.3s ease";

    element.scrollIntoView({ behavior: "smooth", block: "center" });
    highlightState.highlightedElements.push(element);
  });
}

// Export for use in other modules
if (typeof window !== "undefined") {
  window.highlightElements = highlightElements;
  window.clearHighlights = clearHighlights;
  window.highlightFilteredIssues = highlightFilteredIssues;
  window.clearFilterHighlights = clearFilterHighlights;
  window.highlightTextWithinElement = highlightTextWithinElement;
  window.clearTextHighlights = clearTextHighlights;
  console.log("[Content Script] Highlighting functions exported to window:", {
    highlightElements: typeof window.highlightElements,
    clearHighlights: typeof window.clearHighlights,
    highlightFilteredIssues: typeof window.highlightFilteredIssues,
    clearFilterHighlights: typeof window.clearFilterHighlights,
    highlightTextWithinElement: typeof window.highlightTextWithinElement,
    clearTextHighlights: typeof window.clearTextHighlights,
  });
}
