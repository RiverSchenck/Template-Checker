(() => {
const HIGHLIGHT_SCRIPT_KEY = "__templateCheckerHighlightScriptInstalled";

if (typeof window !== "undefined" && !window[HIGHLIGHT_SCRIPT_KEY]) {
window[HIGHLIGHT_SCRIPT_KEY] = true;

// Main content script entry point

let highlightActive = false;
let messageListenerRegistered = false;

function teardownHighlight() {
  highlightActive = false;
  if (typeof window !== 'undefined') {
    if (window.clearHighlights) window.clearHighlights();
    if (window.clearFilterHighlights) window.clearFilterHighlights();
  }
}

// Only initialize on Frontify sites (we only inject on template page; teardown when leaving it)
async function initializeIfFrontifySite() {
  // Check if we're on a Frontify site
  if (typeof window === 'undefined' || !window.waitForFrontifySite) {
    // If detector isn't loaded yet, wait a bit and try again
    setTimeout(initializeIfFrontifySite, 100);
    return;
  }

  const isFrontify = await window.waitForFrontifySite(5000);
  if (!isFrontify) {
    setupMessageListener();
    return;
  }

  if (!window.isTemplateCheckerTemplatePageActive?.()) {
    return;
  }

  highlightActive = true;

  setupMessageListener();
}

function setupMessageListener() {
  if (messageListenerRegistered) {
    return;
  }
  messageListenerRegistered = true;

  // Handle messages from the extension
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!highlightActive && message.action !== 'clear' && message.action !== 'clearFilterHighlights') {
    sendResponse({ success: false, error: 'Template page not active' });
    return true;
  }
  if (message.action === 'highlight') {
    if (!message.dataId) {
      sendResponse({ success: false, error: 'No dataId provided' });
      return true;
    }
    const dataId = message.dataId;
    const textContent = message.textContent || null;
    const spreadId = message.spreadId || null;

    function doHighlight() {
      if (typeof window !== 'undefined' && window.highlightElements) {
        window.highlightElements(dataId, textContent);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'highlightElements not available' });
      }
    }

    if (spreadId) {
      const spreadEl = document.querySelector('li[data-id="' + CSS.escape(spreadId) + '"]');
      if (spreadEl) {
        const alreadySelected =
          spreadEl.getAttribute('aria-selected') === 'true' ||
          spreadEl.classList.contains('selected') ||
          spreadEl.classList.contains('active') ||
          spreadEl.classList.contains('current') ||
          spreadEl.classList.contains('state-selected');
        if (alreadySelected) {
          doHighlight();
        } else {
          spreadEl.click();
          setTimeout(doHighlight, 400);
        }
      } else {
        doHighlight();
      }
    } else {
      doHighlight();
    }
    return true;
  }

  if (message.action === 'clear') {
    if (typeof window !== 'undefined' && window.clearHighlights) {
      window.clearHighlights();
      sendResponse({ success: true });
    } else {
      sendResponse({ success: true });
    }
    return true;
  }

  if (message.action === 'highlightFilteredIssues') {
    if (typeof window !== 'undefined' && window.highlightFilteredIssues) {
      try {
        window.highlightFilteredIssues(message.errors || [], message.warnings || [], message.infos || []);
        sendResponse({ success: true });
      } catch (error) {
        console.error("Template Checker: Error executing highlightFilteredIssues:", error);
        sendResponse({ success: false, error: error.message });
      }
    } else {
      console.error("Template Checker: highlightFilteredIssues function not available on window");
      sendResponse({ success: false, error: 'highlightFilteredIssues function not available' });
    }
    return true;
  }

  if (message.action === 'clearFilterHighlights') {
    if (typeof window !== 'undefined' && window.clearFilterHighlights) {
      try {
        window.clearFilterHighlights();
        sendResponse({ success: true });
      } catch (error) {
        console.error("Template Checker: Error executing clearFilterHighlights:", error);
        sendResponse({ success: false, error: error.message });
      }
    } else {
      console.warn("Template Checker: clearFilterHighlights function not available");
      sendResponse({ success: true });
    }
    return true;
  }

    return false;
  });

  // Clear highlights when page is unloaded
  window.addEventListener('beforeunload', () => {
    if (typeof window !== 'undefined' && window.clearHighlights) {
      window.clearHighlights();
    }
  });
}

window.addEventListener('template-checker-show', initializeIfFrontifySite);
window.addEventListener('template-checker-hide', teardownHighlight);

if (window.isTemplateCheckerTemplatePageActive?.()) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeIfFrontifySite, { once: true });
  } else {
    initializeIfFrontifySite();
  }
}
}
})();
