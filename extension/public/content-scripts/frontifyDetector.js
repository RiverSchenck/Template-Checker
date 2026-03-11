(() => {
const BOOTSTRAP_KEY = "__templateCheckerFrontifyDetectorInstalled";
const TEMPLATE_PAGE_PATH_REGEX = /\/brands\/[^/]+\/template-libraries\/[^/]+\/templates/;

if (typeof window !== "undefined" && !window[BOOTSTRAP_KEY]) {
  window[BOOTSTRAP_KEY] = true;

  let isTemplateRouteActive = false;
  let featuresInjected = false;
  let injectPromise = null;

  function isTemplatePage() {
    try {
      return TEMPLATE_PAGE_PATH_REGEX.test(location.pathname || "");
    } catch {
      return false;
    }
  }

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

  function dispatchRouteEvent(match) {
    window.dispatchEvent(
      new CustomEvent(match ? "template-checker-show" : "template-checker-hide", {
        detail: { match },
      }),
    );
  }

  function isTemplateCheckerTemplatePageActive() {
    return isTemplateRouteActive;
  }

  async function ensureFeatureScriptsInjected() {
    if (featuresInjected) return true;
    try {
      if (!chrome.runtime?.sendMessage) return false;
    } catch (_e) {
      return false;
    }
    if (!injectPromise) {
      injectPromise = (function () {
        try {
          return chrome.runtime.sendMessage({ action: "ensureFrontifyFeatureScripts" });
        } catch (_e) {
          return Promise.reject(_e);
        }
      })()
        .then((response) => {
          if (!response?.success) {
            throw new Error(response?.error || "Injection failed");
          }
          featuresInjected = true;
          return true;
        })
        .catch((error) => {
          console.warn("Template Checker: Failed to inject Frontify feature scripts:", error);
          return false;
        })
        .finally(() => {
          injectPromise = null;
        });
    }
    return injectPromise;
  }

  async function syncRouteState() {
    const match = isTemplatePage();
    if (match === isTemplateRouteActive) return;

    isTemplateRouteActive = match;

    if (match) {
      await ensureFeatureScriptsInjected();
      dispatchRouteEvent(true);
      return;
    }

    dispatchRouteEvent(false);
  }

  function installHistoryWatcher() {
    const wrap = (methodName) => {
      const original = history[methodName];
      if (typeof original !== "function") return;
      history[methodName] = function wrappedHistoryMethod(...args) {
        const result = original.apply(this, args);
        queueMicrotask(syncRouteState);
        return result;
      };
    };

    wrap("pushState");
    wrap("replaceState");
    window.addEventListener("popstate", syncRouteState);

    let lastHref = location.href;
    setInterval(() => {
      if (location.href === lastHref) return;
      lastHref = location.href;
      syncRouteState();
    }, 500);
  }

  window.isTemplatePage = isTemplatePage;
  window.isFrontifySite = isFrontifySite;
  window.waitForFrontifySite = waitForFrontifySite;
  window.isTemplateCheckerTemplatePageActive = isTemplateCheckerTemplatePageActive;

  installHistoryWatcher();
  syncRouteState();
}
})();
