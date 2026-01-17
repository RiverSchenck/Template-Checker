// Utility function to detect if we're on a Frontify site
// This allows the extension to work with different Frontify client domains

function isFrontifySite() {
  // Check for Frontify-specific classes and elements that indicate this is a Frontify site
  const frontifyIndicators = [
    // Check for Frontify canvas elements
    () => document.querySelector('.o-canvas__item--selectable'),
    () => document.querySelector('.js-o-canvas__item--selectable'),
    // Check for Frontify-specific data attributes
    () => document.querySelector('[data-test-id="export-progress-bar-anchor-button"]'),
    () => document.querySelector('[data-test-id="fondue-dropdown-content"]'),
    () => document.querySelector('[data-test-id="fondue-button"]'),
    // Check for Frontify-specific class patterns
    () => document.querySelector('.fondue-button'),
    // Check for Frontify in window object or meta tags
    () => {
      if (typeof window !== 'undefined') {
        // Check for Frontify-specific global variables
        if (window.frontify || window.Frontify) {
          return true;
        }
      }
      return false;
    },
    () => {
      // Check meta tags for Frontify
      const metaTags = document.querySelectorAll('meta[name*="frontify"], meta[property*="frontify"]');
      return metaTags.length > 0;
    }
  ];

  // Try each indicator - if any return a truthy value, we're on a Frontify site
  for (const check of frontifyIndicators) {
    try {
      const result = check();
      if (result) {
        return true;
      }
    } catch (e) {
      // Continue checking other indicators if one fails
      continue;
    }
  }

  return false;
}

// Wait for DOM and check if this is a Frontify site
// Returns a promise that resolves to true if it's a Frontify site
function waitForFrontifySite(timeout = 5000) {
  return new Promise((resolve) => {
    // Check immediately
    if (isFrontifySite()) {
      resolve(true);
      return;
    }

    // If DOM isn't ready, wait for it
    if (document.readyState === 'loading') {
      const checkOnReady = () => {
        if (isFrontifySite()) {
          resolve(true);
          document.removeEventListener('DOMContentLoaded', checkOnReady);
          return;
        }
      };
      document.addEventListener('DOMContentLoaded', checkOnReady);
    }

    // Set up observer to watch for Frontify elements being added
    let observer = null;
    const startObserving = () => {
      if (observer) return;

      observer = new MutationObserver(() => {
        if (isFrontifySite()) {
          resolve(true);
          if (observer) {
            observer.disconnect();
            observer = null;
          }
        }
      });

      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
      });
    };

    if (document.body) {
      startObserving();
    } else {
      const bodyCheck = setInterval(() => {
        if (document.body) {
          clearInterval(bodyCheck);
          startObserving();
        }
      }, 100);
    }

    // Timeout after specified time
    setTimeout(() => {
      resolve(isFrontifySite());
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    }, timeout);
  });
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.isFrontifySite = isFrontifySite;
  window.waitForFrontifySite = waitForFrontifySite;
}
