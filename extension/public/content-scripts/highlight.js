// Main content script entry point

// Only initialize on Frontify sites
async function initializeIfFrontifySite() {
  // Check if we're on a Frontify site
  if (typeof window === 'undefined' || !window.waitForFrontifySite) {
    // If detector isn't loaded yet, wait a bit and try again
    setTimeout(initializeIfFrontifySite, 100);
    return;
  }

  const isFrontify = await window.waitForFrontifySite(5000);
  if (!isFrontify) {
    // Not a Frontify site, but we still need to listen for messages
    // (highlighting might be triggered from extension popup)
    setupMessageListener();
    return;
  }

  // Check if highlighting functions are available
  console.log('[Content Script] highlight.js loaded on Frontify site');
  console.log('[Content Script] Window highlighting functions available:', {
    highlightElements: typeof window !== 'undefined' && typeof window.highlightElements !== 'undefined',
    clearHighlights: typeof window !== 'undefined' && typeof window.clearHighlights !== 'undefined',
    highlightFilteredIssues: typeof window !== 'undefined' && typeof window.highlightFilteredIssues !== 'undefined',
    clearFilterHighlights: typeof window !== 'undefined' && typeof window.clearFilterHighlights !== 'undefined'
  });

  setupMessageListener();
}

function setupMessageListener() {
  // Handle messages from the extension
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Content Script] Received message:', message.action);
  if (message.action === 'highlight') {
    if (message.dataId && typeof window !== 'undefined' && window.highlightElements) {
      window.highlightElements(message.dataId, message.textContent || null);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'No dataId provided' });
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
    console.log('[Content Script] Received highlightFilteredIssues:', {
      errors: message.errors?.length || 0,
      warnings: message.warnings?.length || 0,
      infos: message.infos?.length || 0
    });

    if (typeof window !== 'undefined' && window.highlightFilteredIssues) {
      try {
        window.highlightFilteredIssues(message.errors || [], message.warnings || [], message.infos || []);
        console.log('[Content Script] highlightFilteredIssues executed successfully');
        sendResponse({ success: true });
      } catch (error) {
        console.error('[Content Script] Error executing highlightFilteredIssues:', error);
        sendResponse({ success: false, error: error.message });
      }
    } else {
      console.error('[Content Script] highlightFilteredIssues function not available on window');
      sendResponse({ success: false, error: 'highlightFilteredIssues function not available' });
    }
    return true;
  }

  if (message.action === 'clearFilterHighlights') {
    console.log('[Content Script] Received clearFilterHighlights');
    if (typeof window !== 'undefined' && window.clearFilterHighlights) {
      try {
        window.clearFilterHighlights();
        console.log('[Content Script] clearFilterHighlights executed successfully');
        sendResponse({ success: true });
      } catch (error) {
        console.error('[Content Script] Error executing clearFilterHighlights:', error);
        sendResponse({ success: false, error: error.message });
      }
    } else {
      console.warn('[Content Script] clearFilterHighlights function not available');
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

// Initialize only if on a Frontify site
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeIfFrontifySite);
} else {
  initializeIfFrontifySite();
}
