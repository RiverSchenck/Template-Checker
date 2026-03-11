// Runs on frontend origins; forwards messages from the page to the extension.
function safeSendMessage(msg) {
  try {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;
    chrome.runtime.sendMessage(msg).catch(function () {});
  } catch (_e) {
    // Extension context invalidated (e.g. extension reloaded/disabled) - ignore
  }
}

window.addEventListener("message", function (event) {
  if (event.source !== window) return;
  var data = event.data;

  if (data?.action === "highlightOnFrontify") {
    var dataId = data.dataId;
    var textContent = data.textContent;
    var spreadId = data.spreadId;
    if (dataId) {
      safeSendMessage({
        action: "highlightOnFrontify",
        dataId: dataId,
        textContent: textContent || undefined,
        spreadId: spreadId || undefined,
      });
    }
  }
  if (data?.action === "highlightFilteredIssuesOnFrontify") {
    safeSendMessage({
      action: "highlightFilteredIssuesOnFrontify",
      errors: data.errors || [],
      warnings: data.warnings || [],
      infos: data.infos || [],
    });
  }
  if (data?.action === "clearFilterHighlightsOnFrontify") {
    safeSendMessage({ action: "clearFilterHighlightsOnFrontify" });
  }
});

// Receive spread filter from background (when user clicks a spread in Frontify) and forward to the page.
chrome.runtime.onMessage.addListener(
  function (message, _sender, _sendResponse) {
    if (message.action === "setSpreadFilter") {
      var spreadId = message.spreadId;
      window.postMessage(
        { type: "TEMPLATE_CHECKER_SPREAD_FILTER", spreadId: spreadId || null },
        "*",
      );
    }
    if (message.action === "setDataIdFilter") {
      var dataId = message.dataId;
      window.postMessage(
        { type: "TEMPLATE_CHECKER_DATA_ID_FILTER", dataId: dataId || null },
        "*",
      );
    }
  },
);

// When user selects a spread in Frontify, forward to the page (storage fallback for when tab was opened after selection).
chrome.storage.onChanged.addListener(function (changes, areaName) {
  if (areaName !== "session") return;
  var spreadChange = changes.selectedSpreadIdForFilter;
  if (!spreadChange) return;
  var spreadId = spreadChange.newValue;
  window.postMessage(
    { type: "TEMPLATE_CHECKER_SPREAD_FILTER", spreadId: spreadId || null },
    "*",
  );
});
