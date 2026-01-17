// Watch for element selection in Frontify

// Only run on Frontify sites
async function initializeIfFrontifySite() {
  // Check if we're on a Frontify site
  if (typeof window === 'undefined' || !window.waitForFrontifySite) {
    return; // Detector not loaded yet
  }

  const isFrontify = await window.waitForFrontifySite(5000);
  if (!isFrontify) {
    return; // Not a Frontify site, exit early
  }

  // Initialize the selection watchers
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

      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        lastSentDataId = dataId;
        chrome.runtime.sendMessage({
          action: 'elementSelected',
          dataId: dataId
        }).catch(() => {});
      }
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

  checkForSelectedElements();

  window.addEventListener('beforeunload', () => {
    clearInterval(checkInterval);
  });
}

// Watch for clicks on <li> elements with data-id=spread_id
function watchForSpreadClicks() {
  function handleSpreadClick(event) {
    // Check if the clicked element or its closest <li> ancestor has a data-id
    const target = event.target.closest('li[data-id]');
    if (!target || target.tagName !== 'LI') {
      return;
    }

    const spreadId = target.getAttribute('data-id');
    if (!spreadId) {
      return;
    }

    // Prevent the click from triggering other handlers if needed
    // event.stopPropagation(); // Uncomment if needed

    // Send message to background script
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        action: 'spreadSelected',
        spreadId: spreadId
      }).catch(() => {});
    }
  }

  // Use event delegation to handle clicks on <li> elements
  // Using capture phase to catch clicks early
  document.addEventListener('click', handleSpreadClick, true);
}

// Initialize only if on a Frontify site
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeIfFrontifySite);
} else {
  initializeIfFrontifySite();
}
