// Injected at build time by copy-extension-files.js
const WEB_APP_BASE = "__WEB_APP_URL__";

function openWebAppTab(urlSuffix = "") {
  const base = WEB_APP_BASE.replace(/\/$/, "");
  const url = urlSuffix ? base + urlSuffix : base;
  chrome.tabs.create({ url: url });
}

chrome.action.onClicked.addListener(() => {
  openWebAppTab();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
      const checkerTab = tabs.find(
        (t) =>
          t.id != null &&
          t.url &&
          !t.url.startsWith("chrome-") &&
          !t.url.startsWith("edge://") &&
          (t.url.includes("template-checker.fly.dev") ||
            t.url.includes("template-checker-test.fly.dev") ||
            t.url.startsWith("http://localhost:3000")),
      );
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
      const checkerTab = tabs.find(
        (t) =>
          t.id != null &&
          t.url &&
          !t.url.startsWith("chrome-") &&
          !t.url.startsWith("edge://") &&
          (t.url.includes("template-checker.fly.dev") ||
            t.url.includes("template-checker-test.fly.dev") ||
            t.url.startsWith("http://localhost:3000")),
      );
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
    const webAppUrl =
      WEB_APP_BASE.replace(/\/$/, "") + "/?checkUrl=" + encodeURIComponent(url);
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
