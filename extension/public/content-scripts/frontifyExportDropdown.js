(() => {
const EXPORT_DROPDOWN_KEY = "__templateCheckerExportDropdownInstalled";

if (typeof window !== "undefined" && !window[EXPORT_DROPDOWN_KEY]) {
window[EXPORT_DROPDOWN_KEY] = true;

// Watch for Frontify export dropdown and modify "InDesign (with changes)" option

let exportDropdownObserver = null;
let exportDropdownInterval = null;
let exportPulseDismissed = false;
let formatTriggerPulseDismissed = false;
let checkerMenuItemPulseDismissed = false;
let downloadButtonPulseDismissed = false;

const EXPORT_BUTTON_SELECTOR =
  '[data-test-id="navigation-topbar-item-export-flyout"]';
const EXPORT_FORMAT_TRIGGER_SELECTOR =
  '[data-test-id="export-formats-dropdown-trigger"]';
const EXPORT_MENU_ITEM_SELECTOR =
  '[data-test-id="export-formats-dropdown-menu-item"]';
const EXPORT_DOWNLOAD_BUTTON_SELECTOR =
  '[data-test-id="export-flyout-form-footer"]';
const EXPORT_PULSE_STYLE_ID = "template-checker-export-pulse-styles";
const EXPORT_PULSE_CLASS = "template-checker-export-pulse";

// Only run on Frontify sites (we only inject on template page; teardown when leaving it)
async function initializeIfFrontifySite() {
  // Check if we're on a Frontify site
  if (typeof window === 'undefined' || !window.waitForFrontifySite) {
    return; // Detector not loaded yet
  }

  const isFrontify = await window.waitForFrontifySite(5000);
  if (!isFrontify || !window.isTemplateCheckerTemplatePageActive?.()) {
    return; // Not a Frontify site, exit early
  }

  // Initialize the dropdown watcher
  watchForExportDropdown();
}

function watchForExportDropdown() {
  function ensurePulseStyles() {
    if (document.getElementById(EXPORT_PULSE_STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = EXPORT_PULSE_STYLE_ID;
    style.textContent = `
      @keyframes template-checker-export-pulse {
        0% {
          box-shadow: 0 0 0 0 rgba(124, 87, 255, 0.55);
        }
        70% {
          box-shadow: 0 0 0 10px rgba(124, 87, 255, 0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(124, 87, 255, 0);
        }
      }

      .${EXPORT_PULSE_CLASS} {
        position: relative;
        border-radius: 10px !important;
        animation: template-checker-export-pulse 1.6s ease-out infinite;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function clearExportPulse() {
    const exportButton = document.querySelector(EXPORT_BUTTON_SELECTOR);
    exportButton?.classList.remove(EXPORT_PULSE_CLASS);
  }

  function clearFormatTriggerPulse() {
    const formatTrigger = document.querySelector(EXPORT_FORMAT_TRIGGER_SELECTOR);
    formatTrigger?.classList.remove(EXPORT_PULSE_CLASS);
  }

  function clearCheckerMenuItemPulse() {
    document.querySelectorAll(EXPORT_MENU_ITEM_SELECTOR).forEach((item) => {
      if (item.textContent?.trim() === "InDesign (with changes)") {
        item.classList.remove(EXPORT_PULSE_CLASS);
      }
    });
  }

  function clearDownloadButtonPulse() {
    const downloadButton = document.querySelector(EXPORT_DOWNLOAD_BUTTON_SELECTOR);
    downloadButton?.classList.remove(EXPORT_PULSE_CLASS);
  }

  function markPulseDismissed() {
    exportPulseDismissed = true;
    clearExportPulse();
  }

  function markFormatTriggerPulseDismissed() {
    formatTriggerPulseDismissed = true;
    clearFormatTriggerPulse();
  }

  function markCheckerMenuItemPulseDismissed() {
    checkerMenuItemPulseDismissed = true;
    clearCheckerMenuItemPulse();
  }

  function markDownloadButtonPulseDismissed() {
    downloadButtonPulseDismissed = true;
    clearDownloadButtonPulse();
  }

  function ensureExportPulse() {
    if (exportPulseDismissed) {
      clearExportPulse();
      return;
    }

    const exportButton = document.querySelector(EXPORT_BUTTON_SELECTOR);
    if (!exportButton) {
      return;
    }

    ensurePulseStyles();
    exportButton.classList.add(EXPORT_PULSE_CLASS);

    if (exportButton.dataset.templateCheckerPulseBound === "true") {
      return;
    }

    exportButton.dataset.templateCheckerPulseBound = "true";
    exportButton.addEventListener("click", markPulseDismissed, {
      capture: true,
      once: true,
    });
  }

  function ensureFormatTriggerPulse() {
    if (formatTriggerPulseDismissed) {
      clearFormatTriggerPulse();
      return;
    }

    const formatTrigger = document.querySelector(EXPORT_FORMAT_TRIGGER_SELECTOR);
    if (!formatTrigger) {
      return;
    }

    ensurePulseStyles();
    formatTrigger.classList.add(EXPORT_PULSE_CLASS);
  }

  function getCheckerMenuItem() {
    return Array.from(document.querySelectorAll(EXPORT_MENU_ITEM_SELECTOR)).find(
      (item) => item.textContent?.trim() === "InDesign (with changes)",
    );
  }

  function isFormatTriggerOnInDesign() {
    const formatTrigger = document.querySelector(EXPORT_FORMAT_TRIGGER_SELECTOR);
    if (!formatTrigger) {
      return false;
    }

    return formatTrigger.textContent?.includes("InDesign (with changes)") || false;
  }

  function isFormatTriggerDropdownOpen() {
    const formatTrigger = document.querySelector(EXPORT_FORMAT_TRIGGER_SELECTOR);
    if (!formatTrigger) {
      return false;
    }

    return (
      formatTrigger.getAttribute("data-state") === "open" ||
      formatTrigger.getAttribute("aria-expanded") === "true"
    );
  }

  function ensureCheckerMenuItemPulse() {
    if (checkerMenuItemPulseDismissed) {
      clearCheckerMenuItemPulse();
      return;
    }

    const menuItem = getCheckerMenuItem();
    if (!menuItem) {
      return;
    }

    ensurePulseStyles();
    menuItem.classList.add(EXPORT_PULSE_CLASS);

    if (menuItem.dataset.templateCheckerPulseBound === "true") {
      return;
    }

    menuItem.dataset.templateCheckerPulseBound = "true";
    menuItem.addEventListener("click", markCheckerMenuItemPulseDismissed, {
      capture: true,
      once: true,
    });
  }

  function ensureDownloadButtonPulse() {
    if (downloadButtonPulseDismissed) {
      clearDownloadButtonPulse();
      return;
    }

    const downloadButton = document.querySelector(EXPORT_DOWNLOAD_BUTTON_SELECTOR);
    if (!downloadButton) {
      return;
    }

    ensurePulseStyles();
    downloadButton.classList.add(EXPORT_PULSE_CLASS);

    if (downloadButton.dataset.templateCheckerPulseBound === "true") {
      return;
    }

    downloadButton.dataset.templateCheckerPulseBound = "true";
    downloadButton.addEventListener("click", markDownloadButtonPulseDismissed, {
      capture: true,
      once: true,
    });
  }

  function checkAndInject() {
    ensureExportPulse();

    const dropdownContent = document.querySelector('[data-test-id="fondue-dropdown-content"][role="menu"][data-state="open"]') ||
                            document.querySelector('[data-test-id="fondue-dropdown-content"][role="menu"]');
    const formatTrigger = document.querySelector(EXPORT_FORMAT_TRIGGER_SELECTOR);
    const formatTriggerDropdownOpen = isFormatTriggerDropdownOpen();

    if (isFormatTriggerOnInDesign()) {
      markFormatTriggerPulseDismissed();
      ensureDownloadButtonPulse();
    } else {
      clearDownloadButtonPulse();
    }

    if (formatTrigger) {
      markPulseDismissed();
      if (formatTriggerDropdownOpen) {
        clearFormatTriggerPulse();
      } else if (!formatTriggerPulseDismissed) {
        ensureFormatTriggerPulse();
      }
    }

    if (dropdownContent) {
      const hasMenuItems = dropdownContent.querySelector('[data-test-id="export-formats-dropdown-menu-item"]');
      if (hasMenuItems) {
        ensureCheckerMenuItemPulse();
      }
    } else if (formatTrigger?.getAttribute("data-state") === "open") {
      markFormatTriggerPulseDismissed();
    }
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          if (node.matches?.('[data-test-id="fondue-dropdown-content"]') ||
              node.querySelector?.('[data-test-id="fondue-dropdown-content"]')) {
            setTimeout(checkAndInject, 100);
          }
        }
      });

      if (mutation.type === 'attributes' && mutation.attributeName === 'data-state') {
        const target = mutation.target;
        if (target.matches?.('[data-test-id="fondue-dropdown-content"][role="menu"]') &&
            target.getAttribute('data-state') === 'open') {
          setTimeout(checkAndInject, 100);
        }
      }
    });

    checkAndInject();
  });
  exportDropdownObserver = observer;

  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state']
    });

    setTimeout(checkAndInject, 500);
    exportDropdownInterval = setInterval(checkAndInject, 500);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    });
  }
}

function teardownExportDropdown() {
  if (exportDropdownObserver) {
    exportDropdownObserver.disconnect();
    exportDropdownObserver = null;
  }
  if (exportDropdownInterval != null) {
    clearInterval(exportDropdownInterval);
    exportDropdownInterval = null;
  }
  const exportButton = document.querySelector(EXPORT_BUTTON_SELECTOR);
  exportButton?.classList.remove(EXPORT_PULSE_CLASS);
  const formatTrigger = document.querySelector(EXPORT_FORMAT_TRIGGER_SELECTOR);
  formatTrigger?.classList.remove(EXPORT_PULSE_CLASS);
  clearCheckerMenuItemPulse();
  clearDownloadButtonPulse();
}

window.addEventListener('template-checker-show', initializeIfFrontifySite);
window.addEventListener('template-checker-hide', teardownExportDropdown);

if (window.isTemplateCheckerTemplatePageActive?.()) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeIfFrontifySite, { once: true });
  } else {
    initializeIfFrontifySite();
  }
}
}
})();
