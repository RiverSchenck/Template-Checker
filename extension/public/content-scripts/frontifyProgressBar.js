// Watch for Frontify download progress bar and inject "Checker" button

// Only run on Frontify sites
async function initializeIfFrontifySite() {
  // Check if we're on a Frontify site
  if (typeof window === 'undefined' || !window.waitForFrontifySite) {
    return; // Detector not loaded yet
  }

  const isFrontify = await window.waitForFrontifySite(5000);
  if (!isFrontify) {
    return; // Not a Frontify site, exit early
  }

  // Initialize the progress bar watcher
  watchForFrontifyProgressBar();
}

function watchForFrontifyProgressBar() {
  const processedBars = new WeakSet();

  function injectExtensionButton(progressBar) {
    if (processedBars.has(progressBar)) {
      return;
    }

    const anchorButton = progressBar.querySelector('a[data-test-id="export-progress-bar-anchor-button"]');
    if (!anchorButton?.href) {
      return;
    }

    const downloadButton = progressBar.querySelector('button[aria-label="Download"]');
    let buttonContainer = null;

    if (downloadButton) {
      let parent = downloadButton.parentElement;
      while (parent && parent !== progressBar) {
        if (parent.classList.contains('tw-flex') &&
            parent.classList.contains('tw-flex-nowrap') &&
            parent.classList.contains('tw-gap-2')) {
          buttonContainer = parent;
          break;
        }
        parent = parent.parentElement;
      }
    }

    if (!buttonContainer) {
      const allDivs = progressBar.querySelectorAll('div');
      for (let div of allDivs) {
        if (div.classList.contains('tw-flex') &&
            div.classList.contains('tw-flex-nowrap') &&
            div.classList.contains('tw-gap-2') &&
            div.querySelector('button')) {
          buttonContainer = div;
          break;
        }
      }
    }

    if (!buttonContainer) {
      return;
    }

    if (buttonContainer.querySelector('[data-test-id="extension-check-url-button"]')) {
      processedBars.add(progressBar);
      return;
    }

    const downloadUrl = anchorButton.href;
    const existingButton = progressBar.querySelector('button[data-test-id="fondue-button"]');

    const extensionButton = document.createElement('button');
    extensionButton.type = 'button';
    extensionButton.setAttribute('data-test-id', 'extension-check-url-button');
    extensionButton.setAttribute('data-variant', 'default');
    extensionButton.setAttribute('data-size', 'medium');
    extensionButton.setAttribute('data-emphasis', 'strong');
    extensionButton.setAttribute('data-rounding', 'medium');
    extensionButton.setAttribute('data-aspect', 'default');
    extensionButton.setAttribute('data-hug-width', 'true');
    extensionButton.setAttribute('aria-label', 'Check in Extension');

    if (existingButton?.className) {
      extensionButton.className = existingButton.className;
    }

    extensionButton.style.backgroundColor = '#7C57FF';
    extensionButton.style.color = 'white';
    extensionButton.addEventListener('mouseenter', () => {
      extensionButton.style.backgroundColor = '#9A7EFE';
    });
    extensionButton.addEventListener('mouseleave', () => {
      extensionButton.style.backgroundColor = '#7C57FF';
    });

    const buttonText = 'Checker';
    extensionButton.textContent = buttonText;

    extensionButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          action: 'frontifyUrlReceived',
          url: downloadUrl
        }).then(() => {
          extensionButton.textContent = '✓ Sent!';
          setTimeout(() => {
            extensionButton.textContent = buttonText;
          }, 2000);
        }).catch(() => {});
      }
    });

    const closeButton = buttonContainer.querySelector('button[data-test-id="export-progress-bar-close-button"]');
    if (closeButton?.parentNode) {
      closeButton.parentNode.insertBefore(extensionButton, closeButton);
    } else {
      buttonContainer.appendChild(extensionButton);
    }

    processedBars.add(progressBar);
  }

  const observer = new MutationObserver(() => {
    document.querySelectorAll('div.tw-relative.tw-bg-white.tw-pointer-events-auto').forEach((bar) => {
      if (bar.querySelector('a[data-test-id="export-progress-bar-anchor-button"]')) {
        setTimeout(() => injectExtensionButton(bar), 100);
      }
    });
  });

  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      document.querySelectorAll('div.tw-relative.tw-bg-white.tw-pointer-events-auto').forEach((bar) => {
        if (bar.querySelector('a[data-test-id="export-progress-bar-anchor-button"]')) {
          setTimeout(() => injectExtensionButton(bar), 100);
        }
      });
    }, 1000);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    });
  }
}

// Initialize only if on a Frontify site
initializeIfFrontifySite();
