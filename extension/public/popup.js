const statusEl = document.getElementById("status");
const runBtn = document.getElementById("run-btn");
const removeSidebarToggle = document.getElementById("remove-sidebar-toggle");
const removeSidebarInfoBtn = document.getElementById("remove-sidebar-info");
const removeSidebarHelp = document.getElementById("remove-sidebar-help");
const SIDEBAR_PREF_KEY = "popupRemoveSidebar";

function setStatus(message, isError = false) {
  statusEl.textContent = message || "";
  statusEl.classList.toggle("error", Boolean(isError));
}

async function loadPreferences() {
  const stored = await chrome.storage.local.get([SIDEBAR_PREF_KEY]);
  removeSidebarToggle.checked = Boolean(stored[SIDEBAR_PREF_KEY]);
}

async function savePreferences() {
  await chrome.storage.local.set({
    [SIDEBAR_PREF_KEY]: removeSidebarToggle.checked,
  });
}

async function runAction(successMessage) {
  runBtn.disabled = true;
  removeSidebarToggle.disabled = true;
  setStatus("");

  try {
    await savePreferences();
    const response = await chrome.runtime.sendMessage({
      action: "toolbarRun",
      removeSidebar: removeSidebarToggle.checked,
    });
    if (!response?.success) {
      throw new Error(response?.error || "Action failed");
    }

    setStatus(successMessage);
    window.setTimeout(() => window.close(), 500);
  } catch (error) {
    setStatus(error.message || "Action failed", true);
    runBtn.disabled = false;
    removeSidebarToggle.disabled = false;
  }
}

runBtn.addEventListener("click", () => {
  runAction("Template Checker running");
});

removeSidebarToggle.addEventListener("change", savePreferences);

removeSidebarInfoBtn.addEventListener("click", () => {
  const isOpen = removeSidebarHelp.classList.toggle("is-open");
  removeSidebarInfoBtn.setAttribute("aria-expanded", String(isOpen));
  removeSidebarInfoBtn.setAttribute("aria-describedby", isOpen ? "remove-sidebar-help" : "");
});

loadPreferences().catch(() => {});
