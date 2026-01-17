// Utility functions for highlighting elements on the current page

/**
 * Highlight elements on the active tab by data-id attribute
 * @param dataId - The data-id attribute value to match on the page
 */
export async function highlightElement(dataId: string): Promise<void> {
  try {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      console.warn('Chrome extension API not available');
      return;
    }

    // Get all tabs and find the most recently active web page tab
    // Exclude extension pages and chrome:// pages
    const allTabs = await chrome.tabs.query({});

    // Filter to web pages only (not extension or chrome:// pages)
    const webPageTabs = allTabs.filter(tab =>
      tab.url &&
      !tab.url.startsWith('chrome-extension://') &&
      !tab.url.startsWith('chrome://') &&
      !tab.url.startsWith('edge://') &&
      tab.id
    );

    if (webPageTabs.length === 0) {
      console.warn('No web page tabs found to highlight. Make sure you have a web page open.');
      return;
    }

    // Find the active web page tab, or use the most recently active one
    let activeTab = webPageTabs.find(tab => tab.active);

    // If no active web page tab found, use the most recently accessed one
    if (!activeTab) {
      // Sort by lastAccessed (most recent first) and take the first one
      activeTab = webPageTabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
    }

    if (!activeTab?.id) {
      console.warn('No suitable web page tab found for highlighting.');
      return;
    }

    console.log(`Highlighting on tab: ${activeTab.url}`);

    // Use direct message passing to the existing content script - much faster!
    // The content script already has highlightElements function loaded
    try {
      await chrome.tabs.sendMessage(activeTab.id, {
        action: 'highlight',
        dataId: dataId
      });
      console.log(`Highlighted elements with data-id: ${dataId}`);
    } catch (messageError: any) {
      // If message fails (content script might not be loaded), fall back to script injection
      if (messageError.message?.includes('Could not establish connection') ||
          messageError.message?.includes('Receiving end does not exist')) {
        console.log('Content script not ready, using script injection fallback');
        // Fallback to script injection if content script isn't loaded yet
        if (chrome.scripting) {
          await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            func: (dataId: string) => {
              // Clear previous highlights
              const previousHighlights = document.querySelectorAll('[data-highlighted-by-extension]');
              previousHighlights.forEach(el => {
                el.removeAttribute('data-highlighted-by-extension');
                (el as HTMLElement).style.outline = '';
                (el as HTMLElement).style.backgroundColor = '';
              });

              // Find and highlight elements
              const selector = `[data-id="${dataId}"]`;
              const elements = document.querySelectorAll(selector);

              if (elements.length === 0) {
                console.warn(`No elements found with data-id="${dataId}"`);
                return;
              }

              elements.forEach((element: Element) => {
                const htmlEl = element as HTMLElement;
                htmlEl.setAttribute('data-highlighted-by-extension', 'true');
                htmlEl.style.outline = '3px solid #B39DFD';
                htmlEl.style.outlineOffset = '2px';
                htmlEl.style.backgroundColor = 'rgba(179, 157, 253, 0.2)';
                htmlEl.style.transition = 'all 0.3s ease';
                htmlEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              });

              console.log(`Highlighted ${elements.length} element(s) with data-id="${dataId}"`);
            },
            args: [dataId]
          });
        }
      } else {
        throw messageError;
      }
    }
  } catch (error) {
    console.error('Error highlighting elements:', error);
  }
}

/**
 * Highlight filtered issues on the active tab
 * @param errors - Array of data-ids for errors
 * @param warnings - Array of data-ids for warnings
 * @param infos - Array of data-ids for infos
 */
export async function highlightFilteredIssues(
  errors: string[],
  warnings: string[],
  infos: string[]
): Promise<void> {
  try {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      console.warn('Chrome extension API not available');
      return;
    }

    // Get all tabs and find the most recently active web page tab
    const allTabs = await chrome.tabs.query({});

    // Filter to web pages only (not extension or chrome:// pages)
    const webPageTabs = allTabs.filter(tab =>
      tab.url &&
      !tab.url.startsWith('chrome-extension://') &&
      !tab.url.startsWith('chrome://') &&
      !tab.url.startsWith('edge://') &&
      tab.id
    );

    if (webPageTabs.length === 0) {
      console.warn('No web page tabs found to highlight. Make sure you have a web page open.');
      return;
    }

    // Find the active web page tab, or use the most recently active one
    let activeTab = webPageTabs.find(tab => tab.active);
    if (!activeTab) {
      activeTab = webPageTabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
    }

    if (!activeTab?.id) {
      console.warn('No suitable web page tab found for highlighting.');
      return;
    }

    console.log(`Highlighting filtered issues on tab: ${activeTab.url}`);

    try {
      await chrome.tabs.sendMessage(activeTab.id, {
        action: 'highlightFilteredIssues',
        errors: errors,
        warnings: warnings,
        infos: infos
      });
      console.log(`Highlighted filtered issues: ${errors.length} errors, ${warnings.length} warnings, ${infos.length} infos`);
    } catch (messageError: any) {
      console.error('Error sending highlightFilteredIssues message:', messageError);
      throw messageError;
    }
  } catch (error) {
    console.error('Error highlighting filtered issues:', error);
  }
}

/**
 * Clear filter highlights on the active tab
 */
export async function clearFilterHighlights(): Promise<void> {
  try {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      console.warn('Chrome extension API not available');
      return;
    }

    // Get all tabs and find the most recently active web page tab
    const allTabs = await chrome.tabs.query({});

    const webPageTabs = allTabs.filter(tab =>
      tab.url &&
      !tab.url.startsWith('chrome-extension://') &&
      !tab.url.startsWith('chrome://') &&
      !tab.url.startsWith('edge://') &&
      tab.id
    );

    if (webPageTabs.length === 0) {
      console.warn('No web page tabs found to clear highlights');
      return;
    }

    let activeTab = webPageTabs.find(tab => tab.active);
    if (!activeTab) {
      activeTab = webPageTabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
    }

    if (!activeTab?.id) {
      console.warn('No suitable web page tab found');
      return;
    }

    try {
      await chrome.tabs.sendMessage(activeTab.id, {
        action: 'clearFilterHighlights'
      });
      console.log('Cleared filter highlights');
    } catch (messageError: any) {
      console.error('Error sending clearFilterHighlights message:', messageError);
    }
  } catch (error) {
    console.error('Error clearing filter highlights:', error);
  }
}

/**
 * Clear all highlights on the current page
 */
export async function clearHighlights(): Promise<void> {
  try {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      console.warn('Chrome extension API not available');
      return;
    }

    // Get all tabs and find the most recently active web page tab
    const allTabs = await chrome.tabs.query({});

    const webPageTabs = allTabs.filter(tab =>
      tab.url &&
      !tab.url.startsWith('chrome-extension://') &&
      !tab.url.startsWith('chrome://') &&
      !tab.url.startsWith('edge://') &&
      tab.id
    );

    if (webPageTabs.length === 0) {
      console.error('No web page tabs found to clear highlights');
      return;
    }

    let activeTab = webPageTabs.find(tab => tab.active);
    if (!activeTab) {
      activeTab = webPageTabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
    }

    if (!activeTab?.id) {
      console.error('No suitable web page tab found');
      return;
    }

    // Use direct message passing to the existing content script - much faster!
    try {
      await chrome.tabs.sendMessage(activeTab.id, {
        action: 'clear'
      });
      console.log('Cleared highlights');
    } catch (messageError: any) {
      // Fallback to script injection if content script isn't loaded
      if (chrome.scripting) {
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: () => {
            const highlights = document.querySelectorAll('[data-highlighted-by-extension]');
            highlights.forEach(el => {
              el.removeAttribute('data-highlighted-by-extension');
              (el as HTMLElement).style.outline = '';
              (el as HTMLElement).style.backgroundColor = '';
            });
          }
        });
      }
    }
  } catch (error) {
    console.error('Error clearing highlights:', error);
  }
}
