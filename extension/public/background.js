function openOrFocusExtensionWindow() {
  chrome.windows.getAll({ populate: true }, (windows) => {
    const extensionWindow = windows.find(window =>
      window.tabs?.some(t => t.url?.includes(chrome.runtime.getURL('index.html')))
    );

    if (extensionWindow?.id) {
      chrome.windows.update(extensionWindow.id, { focused: true });
    } else {
      chrome.windows.create({
        url: chrome.runtime.getURL('index.html'),
        type: 'normal',
        width: 850,
        height: 650,
        focused: true
      });
    }
  });
}

chrome.action.onClicked.addListener((tab) => {
  openOrFocusExtensionWindow();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'elementSelected') {
    const dataId = message.dataId;

    if (dataId !== null && dataId !== undefined) {
      const isValidDataId = /^[a-zA-Z][a-zA-Z0-9]+$/.test(dataId) && dataId.length >= 3;
      if (!isValidDataId) {
        sendResponse({ success: false, error: 'Invalid data-id' });
        return false;
      }
    }

    chrome.runtime.sendMessage({
      action: 'selectedDataIdChanged',
      dataId: dataId
    }).then(() => {
      sendResponse({ success: true });
    }).catch(() => {
      sendResponse({ success: true });
    });

    return true;
  }

  if (message.action === 'frontifyUrlReceived') {
    const url = message.url;

    chrome.storage.local.set({ pendingFrontifyUrl: url });
    openOrFocusExtensionWindow();

    let retryCount = 0;
    const maxRetries = 15;
    const initialDelay = 200;

    const trySendMessage = () => {
      chrome.runtime.sendMessage({
        action: 'frontifyUrlReceived',
        url: url
      }).then(() => {
        chrome.storage.local.remove('pendingFrontifyUrl');
      }).catch(() => {
        if (retryCount < maxRetries) {
          retryCount++;
          const delay = initialDelay + (retryCount * 100);
          setTimeout(trySendMessage, delay);
        }
      });
    };

    setTimeout(trySendMessage, initialDelay);

    sendResponse({ success: true });
    return true;
  }

  return false;
});
