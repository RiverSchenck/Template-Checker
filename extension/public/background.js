// Injected at build time by copy-extension-files.js
const WEB_APP_BASE = "__WEB_APP_URL__";

function openWebAppTab(urlSuffix = "") {
  const base = WEB_APP_BASE.replace(/\/$/, "");
  const url = urlSuffix ? base + urlSuffix : base;
  chrome.tabs.create({ url: url });
}

function isInjectableUrl(url) {
  return typeof url === "string" && /^(https?:\/\/)/.test(url);
}

function isCheckerTab(tab) {
  if (!tab?.id || !tab?.url) return false;
  if (tab.url.startsWith("chrome-") || tab.url.startsWith("edge://")) return false;
  return (
    tab.url.includes("template-checker.fly.dev") ||
    tab.url.includes("template-checker-test.fly.dev") ||
    tab.url.startsWith("http://localhost:3000")
  );
}

function findCheckerTab(tabs) {
  return tabs.find(isCheckerTab) ?? null;
}

async function ensureFrontifyBootstrapScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content-scripts/frontifyDetector.js"],
  });
}

async function ensureFrontifyFeatureScripts(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [
      "content-scripts/highlighting.js",
      "content-scripts/elementSelection.js",
      "content-scripts/frontifyProgressBar.js",
      "content-scripts/frontifyExportDropdown.js",
      "content-scripts/frontifySidebar.js",
      "content-scripts/highlight.js",
    ],
  });
}

async function runExtensionOnTab(tab) {
  const tabId = tab?.id;
  if (tabId == null || !isInjectableUrl(tab?.url)) {
    throw new Error("Open a regular webpage first.");
  }

  try {
    await ensureFrontifyBootstrapScript(tabId);
    await ensureFrontifyFeatureScripts(tabId);
  } catch (error) {
    console.warn("Template Checker: Failed to inject Frontify bootstrap script:", error);
    throw error;
  }
}

async function setSidebarCollapsedOnTab(tab, collapsed) {
  const tabId = tab?.id;
  if (tabId == null || !isInjectableUrl(tab?.url)) {
    throw new Error("Open a regular webpage first.");
  }

  await ensureFrontifyBootstrapScript(tabId);
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content-scripts/frontifySidebar.js"],
  });
  await chrome.tabs.sendMessage(tabId, {
    action: "templateCheckerSetSidebarCollapsed",
    collapsed: Boolean(collapsed),
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "toolbarRun") {
    chrome.tabs.query({ active: true, lastFocusedWindow: true })
      .then(async (tabs) => {
        const activeTab = tabs[0];
        await runExtensionOnTab(activeTab);
        await setSidebarCollapsedOnTab(activeTab, Boolean(message.removeSidebar));
        sendResponse({ success: true });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error?.message || "Action failed" });
      });

    return true;
  }

  if (message.action === "ensureFrontifyFeatureScripts") {
    const tabId = sender.tab?.id;
    if (tabId == null) {
      sendResponse({ success: false, error: "No sender tab" });
      return false;
    }

    ensureFrontifyFeatureScripts(tabId)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error?.message || "Injection failed" });
      });

    return true;
  }

  if (message.action === "elementSelected") {
    const dataId = message.dataId;

    if (dataId !== null && dataId !== undefined) {
      const isValidDataId =
        /^[a-zA-Z][a-zA-Z0-9]+$/.test(dataId) && dataId.length >= 3;
      if (!isValidDataId) {
        sendResponse({ success: false, error: "Invalid data-id" });
        return false;
      }
    }

    chrome.runtime
      .sendMessage({
        action: "selectedDataIdChanged",
        dataId: dataId,
      })
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(() => {
        sendResponse({ success: true });
      });

    // Tell the template checker web app tab to filter to this data id
    chrome.tabs.query({}, (tabs) => {
      const checkerTab = findCheckerTab(tabs);
      if (checkerTab?.id) {
        chrome.tabs
          .sendMessage(checkerTab.id, {
            action: "setDataIdFilter",
            dataId: dataId,
          })
          .catch(() => {});
      }
    });

    return true;
  }

  if (message.action === "spreadSelected") {
    const spreadId = message.spreadId;

    chrome.storage.session.set({ selectedSpreadIdForFilter: spreadId });

    chrome.runtime
      .sendMessage({
        action: "selectedSpreadChanged",
        spreadId: spreadId,
      })
      .then(() => {})
      .catch(() => {});

    // Tell the template checker web app tab to filter by this spread (same pattern as highlightOnFrontify)
    chrome.tabs.query({}, (tabs) => {
      const checkerTab = findCheckerTab(tabs);
      if (checkerTab?.id) {
        chrome.tabs
          .sendMessage(checkerTab.id, {
            action: "setSpreadFilter",
            spreadId: spreadId,
          })
          .catch(() => {});
      }
    });

    sendResponse({ success: true });
    return true;
  }

  if (message.action === "frontifyUrlReceived") {
    const url = message.url;
    const frontifyTabId = sender.tab?.id;
    // Include extension version so the web app can prompt users to update if they're on an older build.
    // Update manifest.json "version" when you release; the web app compares extVersion to its LATEST_EXTENSION_VERSION.
    const extVersion = chrome.runtime.getManifest().version;
    const webAppUrl =
      WEB_APP_BASE.replace(/\/$/, "") +
      "/?checkUrl=" + encodeURIComponent(url) +
      "&extVersion=" + encodeURIComponent(extVersion);
    chrome.tabs.create({ url: webAppUrl });
    if (frontifyTabId != null) {
      chrome.storage.session.set({ frontifySourceTabId: frontifyTabId });
    }
    sendResponse({ success: true });
    return true;
  }

  if (message.action === "highlightOnFrontify") {
    const { dataId, textContent, spreadId } = message;
    if (!dataId) {
      sendResponse({ success: false, error: "No dataId" });
      return false;
    }
    const isValidDataId =
      /^[a-zA-Z][a-zA-Z0-9]+$/.test(dataId) && dataId.length >= 3;
    if (!isValidDataId) {
      sendResponse({ success: false, error: "Invalid dataId" });
      return false;
    }
    function tryHighlight(targetTabId) {
      return chrome.tabs
        .sendMessage(targetTabId, {
          action: "highlight",
          dataId: dataId,
          textContent: textContent || null,
          spreadId: spreadId || null,
        })
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((err) => {
          if (targetTabId != null) {
            chrome.storage.session.remove("frontifySourceTabId");
          }
          sendResponse({ success: false, error: err.message });
        });
    }
    chrome.storage.session
      .get(["frontifySourceTabId"])
      .then(({ frontifySourceTabId }) => {
        if (frontifySourceTabId != null) {
          tryHighlight(frontifySourceTabId);
          return;
        }
        chrome.tabs.query({}).then((tabs) => {
          const frontifyTab = tabs.find(
            (t) =>
              t.url &&
              t.id &&
              !t.url.startsWith("chrome-extension://") &&
              !t.url.startsWith("chrome://") &&
              !t.url.startsWith("edge://") &&
              (t.url.includes("frontify") || t.url.includes("frontify.com")),
          );
          if (frontifyTab?.id) {
            tryHighlight(frontifyTab.id);
          } else {
            sendResponse({ success: false, error: "No Frontify tab found" });
          }
        });
      });
    return true;
  }

  function sendToFrontifyTab(payload) {
    chrome.storage.session
      .get(["frontifySourceTabId"])
      .then(({ frontifySourceTabId }) => {
        if (frontifySourceTabId != null) {
          chrome.tabs.sendMessage(frontifySourceTabId, payload).catch(() => {
            chrome.storage.session.remove("frontifySourceTabId");
            chrome.tabs.query({}).then((tabs) => {
              const frontifyTab = tabs.find(
                (t) =>
                  t.url &&
                  t.id &&
                  !t.url.startsWith("chrome-extension://") &&
                  !t.url.startsWith("chrome://") &&
                  !t.url.startsWith("edge://") &&
                  (t.url.includes("frontify") ||
                    t.url.includes("frontify.com")),
              );
              if (frontifyTab?.id) {
                chrome.tabs
                  .sendMessage(frontifyTab.id, payload)
                  .catch(() => {});
              }
            });
          });
          return;
        }
        chrome.tabs.query({}).then((tabs) => {
          const frontifyTab = tabs.find(
            (t) =>
              t.url &&
              t.id &&
              !t.url.startsWith("chrome-extension://") &&
              !t.url.startsWith("chrome://") &&
              !t.url.startsWith("edge://") &&
              (t.url.includes("frontify") || t.url.includes("frontify.com")),
          );
          if (frontifyTab?.id) {
            chrome.tabs.sendMessage(frontifyTab.id, payload).catch(() => {});
          }
        });
      });
  }

  if (message.action === "highlightFilteredIssuesOnFrontify") {
    sendToFrontifyTab({
      action: "highlightFilteredIssues",
      errors: message.errors || [],
      warnings: message.warnings || [],
      infos: message.infos || [],
    });
    sendResponse({ success: true });
    return true;
  }

  if (message.action === "clearFilterHighlightsOnFrontify") {
    sendToFrontifyTab({ action: "clearFilterHighlights" });
    sendResponse({ success: true });
    return true;
  }

  return false;
});
