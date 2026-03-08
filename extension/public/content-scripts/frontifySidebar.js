// Toggle Frontify editor sidebar by collapsing its grid column to 0.
// Sidebar stays in the DOM so we never lose it; preview gets full width.

const SIDEBAR_STORAGE_KEY = "template-checker-sidebar-collapsed";
const SIDEBAR_SELECTOR =
  ".mod-editor-sidebar.o-editorsidebar, .mod.mod-editor-sidebar.o-editorsidebar";
const TOGGLE_BTN_ID = "extension-sidebar-toggle-btn";
const PARENT_COLLAPSED_CLASS = "template-checker-sidebar-collapsed";

function getExtensionIconUrl(size = 16) {
  const name =
    size <= 16 ? "tech-sol16.png" : size <= 48 ? "tech-sol48.png" : "tech-sol192.png";
  return typeof chrome !== "undefined" && chrome.runtime?.getURL
    ? chrome.runtime.getURL(name)
    : "";
}

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

function createIconImg(size = 16, alt = "") {
  const img = document.createElement("img");
  img.src = getExtensionIconUrl(size);
  img.alt = alt || "Template Checker";
  img.setAttribute("data-extension-icon", "true");
  img.style.width = size + "px";
  img.style.height = size + "px";
  img.style.flexShrink = "0";
  img.style.display = "block";
  return img;
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
  } else if (!collapsed && hasClass) {
    parent.classList.remove(PARENT_COLLAPSED_CLASS);
    parent.offsetHeight; // force reflow
  }
}

function isSidebarCurrentlyCollapsed() {
  const sidebar = getSidebar();
  if (!sidebar?.parentElement) return false;
  return sidebar.parentElement.classList.contains(PARENT_COLLAPSED_CLASS);
}

function ensureToggleButton() {
  let btn = document.getElementById(TOGGLE_BTN_ID);
  if (btn) return btn;

  btn = document.createElement("button");
  btn.id = TOGGLE_BTN_ID;
  btn.type = "button";
  btn.setAttribute("aria-label", "Toggle sidebar (Template Checker)");
  btn.setAttribute("data-test-id", "extension-sidebar-toggle");
  btn.title = "Toggle sidebar";
  btn.style.cssText = [
    "position: fixed",
    "top: 50%",
    "right: 0",
    "transform: translateY(-50%)",
    "z-index: 2147483646",
    "width: 28px",
    "height: 48px",
    "padding: 0",
    "border: none",
    "border-radius: 6px 0 0 6px",
    "background: #7C57FF",
    "color: #fff",
    "cursor: pointer",
    "display: flex",
    "align-items: center",
    "justify-content: center",
    "box-shadow: -2px 0 8px rgba(0,0,0,0.15)",
    "transition: background 0.15s",
  ].join(";");

  btn.appendChild(createIconImg(16, "Template Checker"));

  btn.addEventListener("mouseenter", () => {
    btn.style.background = "#9A7EFE";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.background = "#7C57FF";
  });

  btn.addEventListener("click", () => {
    const sidebar = getSidebar();
    if (!sidebar) return;
    const collapsed = isSidebarCurrentlyCollapsed();
    setSidebarCollapsedState(sidebar, !collapsed);
    const nowCollapsed = !collapsed;
    btn.title = nowCollapsed ? "Show sidebar" : "Hide sidebar";
    btn.setAttribute(
      "aria-label",
      nowCollapsed ? "Show sidebar (Template Checker)" : "Hide sidebar (Template Checker)",
    );
    // Re-sync after frame and delays (Frontify may re-render and replace the grid node)
    requestAnimationFrame(syncSidebarStateToDom);
    [100, 300, 500].forEach((ms) => setTimeout(syncSidebarStateToDom, ms));
  });

  document.body.appendChild(btn);
  return btn;
}

function setupSidebarToggle(sidebar) {
  if (sidebar.dataset.templateCheckerSidebarSetup === "true") {
    return;
  }
  sidebar.dataset.templateCheckerSidebarSetup = "true";

  const collapsed = isSidebarCollapsed();
  setSidebarCollapsedState(sidebar, collapsed);

  const btn = ensureToggleButton();
  btn.title = collapsed ? "Show sidebar" : "Hide sidebar";
  btn.setAttribute(
    "aria-label",
    collapsed ? "Show sidebar (Template Checker)" : "Hide sidebar (Template Checker)",
  );
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
  if (!isFrontify) {
    return;
  }

  if (document.body) {
    ensureToggleButton();
  }

  function run() {
    findAndSetupSidebar();
  }

  run();
  const observer = new MutationObserver(() => {
    findAndSetupSidebar();
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(run, 500);
    setTimeout(run, 2000);
    setTimeout(run, 5000);
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      ensureToggleButton();
      observer.observe(document.body, { childList: true, subtree: true });
      run();
    });
  }
}

initializeIfFrontifySite();
