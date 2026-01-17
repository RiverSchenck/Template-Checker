// Main content script entry point

// Load highlighting module first
if (typeof window !== 'undefined' && window.highlightElements) {
  // Already loaded
} else {
  // Will be loaded via script tag
}

// Handle messages from the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'highlight') {
    if (message.dataId && typeof window !== 'undefined' && window.highlightElements) {
      window.highlightElements(message.dataId);
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

  return false;
});

// Clear highlights when page is unloaded
window.addEventListener('beforeunload', () => {
  if (typeof window !== 'undefined' && window.clearHighlights) {
    window.clearHighlights();
  }
});
