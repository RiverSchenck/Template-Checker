// Runs on frontend origins; forwards token from callback page to the extension.
window.addEventListener('message', function (event) {
  if (event.source !== window || event.data?.action !== 'extensionAuthToken') return;
  var accessToken = event.data.accessToken;
  var refreshToken = event.data.refreshToken;
  if (accessToken && refreshToken) {
    chrome.runtime.sendMessage({
      action: 'extensionAuthToken',
      accessToken: accessToken,
      refreshToken: refreshToken,
      user: event.data.user
    });
  }
});
