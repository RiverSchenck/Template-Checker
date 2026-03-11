(() => {
const ELEMENT_SELECTION_KEY = "__templateCheckerElementSelectionInstalled";

if (typeof window !== "undefined" && !window[ELEMENT_SELECTION_KEY]) {
window[ELEMENT_SELECTION_KEY] = true;

let selectionCheckInterval = null;
let selectionObserver = null;
let spreadClickHandler = null;
let elementSelectionActive = false;

function safeSendMessage(message) {
  try {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;
    chrome.runtime.sendMessage(message).catch(() => {});
  } catch (_e) {
    // Extension context invalidated (e.g. extension reloaded/disabled) - ignore
  }
}

function teardownElementSelection() {
  if (!elementSelectionActive) return;
  elementSelectionActive = false;

  if (selectionCheckInterval != null) {
    clearInterval(selectionCheckInterval);
    selectionCheckInterval = null;
  }
  if (selectionObserver) {
    selectionObserver.disconnect();
    selectionObserver = null;
  }
  if (spreadClickHandler) {
    document.removeEventListener('click', spreadClickHandler, true);
    spreadClickHandler = null;
  }
}

// Only run on Frontify sites (we only inject on template page URL; teardown when leaving it)
async function initializeIfFrontifySite() {
  if (typeof window === 'undefined' || !window.waitForFrontifySite) {
    return;
  }
  if (elementSelectionActive) return;
  elementSelectionActive = true;

  const isFrontify = await window.waitForFrontifySite(5000);
  if (!isFrontify || !window.isTemplateCheckerTemplatePageActive?.()) {
    elementSelectionActive = false;
    return;
  }

  watchForSelection();
  watchForSpreadClicks();
}

function watchForSelection() {
  let lastSentDataId = null;
  let debounceTimer = null;
  const selectionTimestamps = new Map();

  function handleSelectedElement(element) {
    const dataId = element.getAttribute('data-id');

    if (!dataId) {
      return;
    }

    const isValidDataId = /^[a-zA-Z][a-zA-Z0-9]+$/.test(dataId) && dataId.length >= 3;
    if (!isValidDataId) {
      return;
    }

    if (dataId === lastSentDataId) {
      return;
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    if (!selectionTimestamps.has(dataId)) {
      selectionTimestamps.set(dataId, Date.now());
    }

    debounceTimer = setTimeout(() => {
      const currentDataId = element.getAttribute('data-id');
      if (!currentDataId || currentDataId !== dataId) {
        selectionTimestamps.delete(dataId);
        return;
      }

      if (!element.classList || !element.classList.contains('state-selected')) {
        selectionTimestamps.delete(dataId);
        return;
      }

      const isSelectable = element.classList.contains('o-canvas__item--selectable') ||
                           element.classList.contains('js-o-canvas__item--selectable');
      if (!isSelectable) {
        selectionTimestamps.delete(dataId);
        return;
      }

      const selectedTime = selectionTimestamps.get(dataId);
      const duration = Date.now() - selectedTime;
      if (duration < 200) {
        return;
      }

      lastSentDataId = dataId;
      safeSendMessage({
        action: "elementSelected",
        dataId: dataId,
      });
    }, 250);
  }

  function checkForSelectedElements() {
    const selectedElements = document.querySelectorAll('.state-selected[data-id]');
    if (selectedElements.length > 0) {
      const selectableElements = Array.from(selectedElements).filter(el =>
        el.classList.contains('o-canvas__item--selectable') ||
        el.classList.contains('js-o-canvas__item--selectable')
      );

      if (selectableElements.length > 0) {
        const element = selectableElements[0];
        const dataId = element.getAttribute('data-id');
        if (dataId && dataId !== lastSentDataId) {
          handleSelectedElement(element);
        }
      }
    }
  }

  const checkInterval = setInterval(checkForSelectedElements, 500);
  selectionCheckInterval = checkInterval;

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        const target = mutation.target;
        if (target.nodeType === 1) {
          const element = target;
          const hasSelectedClass = element.classList && element.classList.contains('state-selected');
          const dataId = element.getAttribute('data-id');

          if (hasSelectedClass && dataId) {
            const isSelectable = element.classList.contains('o-canvas__item--selectable') ||
                                 element.classList.contains('js-o-canvas__item--selectable');
            if (isSelectable) {
              handleSelectedElement(element);
            }
          }
        }
      }

      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          const element = node;
          if (element.classList && element.classList.contains('state-selected')) {
            const dataId = element.getAttribute('data-id');
            const isSelectable = element.classList.contains('o-canvas__item--selectable') ||
                                 element.classList.contains('js-o-canvas__item--selectable');
            if (dataId && isSelectable) {
              handleSelectedElement(element);
            }
          }

          const descendants = element.querySelectorAll?.('.state-selected.o-canvas__item--selectable[data-id]');
          if (descendants && descendants.length === 0) {
            const jsSelectable = element.querySelectorAll?.('.state-selected.js-o-canvas__item--selectable[data-id]');
            if (jsSelectable && jsSelectable.length > 0) {
              handleSelectedElement(jsSelectable[0]);
            }
          } else if (descendants && descendants.length > 0) {
            handleSelectedElement(descendants[0]);
          }
        }
      });
    });

    checkForSelectedElements();
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['class'],
    subtree: true,
    childList: true
  });
  selectionObserver = observer;

  checkForSelectedElements();

  window.addEventListener('beforeunload', () => {
    if (selectionCheckInterval != null) clearInterval(selectionCheckInterval);
  });
}

// Watch for clicks on <li> elements with data-id=spread_id
function watchForSpreadClicks() {
  spreadClickHandler = function handleSpreadClick(event) {
    // Only filter the checker app when the user actually clicks a spread in Frontify, not when we programmatically click to navigate for highlight
    if (!event.isTrusted) {
      return;
    }

    // Check if the clicked element or its closest <li> ancestor has a data-id
    const target = event.target.closest('li[data-id]');
    if (!target || target.tagName !== 'LI') {
      return;
    }

    const spreadId = target.getAttribute('data-id');
    if (!spreadId) {
      return;
    }

    // Uncomment event.stopPropagation() below if the spread click causes unwanted navigation or other side effects.
    // event.stopPropagation();

    safeSendMessage({
      action: "spreadSelected",
      spreadId: spreadId,
    });
  }

  document.addEventListener('click', spreadClickHandler, true);
}

function handleTemplateCheckerShow() {
  initializeIfFrontifySite();
}

window.addEventListener('template-checker-show', handleTemplateCheckerShow);
window.addEventListener('template-checker-hide', teardownElementSelection);

if (window.isTemplateCheckerTemplatePageActive?.()) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleTemplateCheckerShow, { once: true });
  } else {
    handleTemplateCheckerShow();
  }
}
}
})();
