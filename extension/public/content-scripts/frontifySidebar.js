(() => {
const SIDEBAR_KEY = "__templateCheckerSidebarInstalled";

if (typeof window !== "undefined" && !window[SIDEBAR_KEY]) {
window[SIDEBAR_KEY] = true;

// Toggle Frontify editor sidebar by collapsing its grid column to 0.
// Sidebar stays in the DOM so we never lose it; preview gets full width.

const SIDEBAR_STORAGE_KEY = "template-checker-sidebar-collapsed";
const SIDEBAR_SELECTOR =
  ".mod-editor-sidebar.o-editorsidebar, .mod.mod-editor-sidebar.o-editorsidebar";
const PARENT_COLLAPSED_CLASS = "template-checker-sidebar-collapsed";

let sidebarMutationObserver = null;

function isSidebarCollapsed() {
  try {
    return sessionStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function setSidebarCollapsed(collapsed) {
  try {
    sessionStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  } catch {}
}

function getSidebar() {
  const el = document.querySelector(SIDEBAR_SELECTOR);
  return el?.classList.contains("mod-editor-sidebar") && el?.classList.contains("o-editorsidebar")
    ? el
    : null;
}

function injectLayoutStyles() {
  if (document.getElementById("template-checker-sidebar-styles")) return;
  const style = document.createElement("style");
  style.id = "template-checker-sidebar-styles";
  style.textContent = `
    /* Collapsed: target terrific-block-wrapper so preview expands to full width */
    [data-test-id="terrific-block-wrapper"].${PARENT_COLLAPSED_CLASS} {
      grid-template-columns: 1fr 0fr !important;
      width: 100% !important;
    }
    /* First column (preview) takes all available space */
    [data-test-id="terrific-block-wrapper"].${PARENT_COLLAPSED_CLASS} > *:first-child {
      min-width: 0 !important;
      width: 100% !important;
      max-width: 100% !important;
      justify-self: stretch !important;
    }
    /* Let the preview column grow, but keep Frontify's internal viewer sizing logic intact. */
    [data-test-id="terrific-block-wrapper"].${PARENT_COLLAPSED_CLASS} .o-editor-publishing,
    [data-test-id="terrific-block-wrapper"].${PARENT_COLLAPSED_CLASS} .o-editor-publishing__container {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
    }
    [data-test-id="terrific-block-wrapper"].${PARENT_COLLAPSED_CLASS} .o-editor-publishing {
      display: flex !important;
      justify-content: center !important;
    }
    [data-test-id="terrific-block-wrapper"].${PARENT_COLLAPSED_CLASS} .o-editor-publishing__container {
      display: flex !important;
      justify-content: center !important;
      overflow: auto !important;
    }
    [data-test-id="terrific-block-wrapper"].${PARENT_COLLAPSED_CLASS} .o-asset-viewer {
      left: 0 !important;
      right: 0 !important;
      margin-left: auto !important;
      margin-right: auto !important;
    }
    /* Second column (sidebar) takes no space */
    [data-test-id="terrific-block-wrapper"].${PARENT_COLLAPSED_CLASS} > *:last-child {
      min-width: 0 !important;
      max-width: 0 !important;
      width: 0 !important;
      overflow: hidden !important;
      visibility: hidden !important;
      padding: 0 !important;
      margin: 0 !important;
      border: none !important;
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}

function requestFrontifyLayoutRefresh() {
  const dispatchResize = () => {
    window.dispatchEvent(new Event("resize"));
  };

  dispatchResize();
  requestAnimationFrame(dispatchResize);
  [100, 250, 500, 1000].forEach((ms) => setTimeout(dispatchResize, ms));
}

function setSidebarCollapsedState(sidebar, collapsed) {
  const parent = sidebar?.parentElement;
  if (!parent) return;
  injectLayoutStyles();
  if (collapsed) {
    parent.classList.add(PARENT_COLLAPSED_CLASS);
  } else {
    parent.classList.remove(PARENT_COLLAPSED_CLASS);
  }
  setSidebarCollapsed(collapsed);
  requestFrontifyLayoutRefresh();
}

/** Re-sync DOM with our collapsed state (in case Frontify re-rendered and replaced the grid node). */
function syncSidebarStateToDom() {
  const sidebar = getSidebar();
  if (!sidebar?.parentElement) return;
  injectLayoutStyles();
  const parent = sidebar.parentElement;
  const collapsed = isSidebarCollapsed();
  const hasClass = parent.classList.contains(PARENT_COLLAPSED_CLASS);
  if (collapsed && !hasClass) {
    parent.classList.add(PARENT_COLLAPSED_CLASS);
    parent.offsetHeight; // force reflow so layout updates
    requestFrontifyLayoutRefresh();
  } else if (!collapsed && hasClass) {
    parent.classList.remove(PARENT_COLLAPSED_CLASS);
    parent.offsetHeight; // force reflow
    requestFrontifyLayoutRefresh();
  }
}

function setupSidebarToggle(sidebar) {
  if (sidebar.dataset.templateCheckerSidebarSetup === "true") {
    return;
  }
  sidebar.dataset.templateCheckerSidebarSetup = "true";

  const collapsed = isSidebarCollapsed();
  setSidebarCollapsedState(sidebar, collapsed);
}

function findAndSetupSidebar() {
  const sidebars = document.querySelectorAll(SIDEBAR_SELECTOR);
  sidebars.forEach((el) => {
    if (
      el.classList.contains("mod-editor-sidebar") &&
      el.classList.contains("o-editorsidebar") &&
      !el.dataset.templateCheckerSidebarSetup
    ) {
      setupSidebarToggle(el);
    }
  });
  // Keep DOM in sync with stored state (e.g. if Frontify re-rendered the grid)
  syncSidebarStateToDom();
}

async function initializeIfFrontifySite() {
  if (typeof window === "undefined" || !window.waitForFrontifySite) {
    return;
  }
  const isFrontify = await window.waitForFrontifySite(5000);
  if (!isFrontify || !window.isTemplateCheckerTemplatePageActive?.()) {
    return;
  }

  function run() {
    findAndSetupSidebar();
  }

  run();
  const observer = new MutationObserver(() => {
    findAndSetupSidebar();
  });
  sidebarMutationObserver = observer;

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(run, 500);
    setTimeout(run, 2000);
    setTimeout(run, 5000);
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      observer.observe(document.body, { childList: true, subtree: true });
      run();
    });
  }
}

function teardownSidebar() {
  if (sidebarMutationObserver) {
    sidebarMutationObserver.disconnect();
    sidebarMutationObserver = null;
  }
  const styleEl = document.getElementById("template-checker-sidebar-styles");
  if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
  const wrapper = document.querySelector('[data-test-id="terrific-block-wrapper"].' + PARENT_COLLAPSED_CLASS);
  if (wrapper) wrapper.classList.remove(PARENT_COLLAPSED_CLASS);
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action !== "templateCheckerSetSidebarCollapsed") {
      return false;
    }

    let handled = false;
    const applyCollapsedState = () => {
      if (handled) {
        return;
      }

      const sidebar = getSidebar();
      if (!sidebar) {
        handled = true;
        sendResponse({ success: false, error: "Sidebar not found" });
        return;
      }

      setupSidebarToggle(sidebar);
      setSidebarCollapsedState(sidebar, Boolean(message.collapsed));
      syncSidebarStateToDom();
      handled = true;
      sendResponse({ success: true });
    };

    requestAnimationFrame(applyCollapsedState);
    setTimeout(applyCollapsedState, 150);
    return true;
  });
}

window.addEventListener('template-checker-show', initializeIfFrontifySite);
window.addEventListener('template-checker-hide', teardownSidebar);

if (window.isTemplateCheckerTemplatePageActive?.()) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeIfFrontifySite, { once: true });
  } else {
    initializeIfFrontifySite();
  }
}
}
})();
