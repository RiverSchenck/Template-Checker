(() => {
const PROGRESS_BAR_KEY = "__templateCheckerProgressBarInstalled";

if (typeof window !== "undefined" && !window[PROGRESS_BAR_KEY]) {
window[PROGRESS_BAR_KEY] = true;

// Watch for Frontify download progress bar and inject "Checker" button

let progressBarObserver = null;
const PROGRESS_BUTTON_SELECTOR = '[data-test-id="extension-check-url-button"]';
const PROGRESS_PULSE_STYLE_ID = "template-checker-progress-pulse-styles";
const PROGRESS_PULSE_CLASS = "template-checker-progress-pulse";

function safeSendMessage(message) {
  try {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return Promise.reject();
    return chrome.runtime.sendMessage(message);
  } catch (_e) {
    return Promise.reject();
  }
}

function clearCheckerButtonPulse(scope = document) {
  scope.querySelectorAll(PROGRESS_BUTTON_SELECTOR).forEach((button) => {
    button.classList.remove(PROGRESS_PULSE_CLASS);
  });
}

// Only run on Frontify sites (we only inject on template page; teardown when leaving it)
async function initializeIfFrontifySite() {
  // Check if we're on a Frontify site
  if (typeof window === "undefined" || !window.waitForFrontifySite) {
    return; // Detector not loaded yet
  }

  const isFrontify = await window.waitForFrontifySite(5000);
  if (!isFrontify || !window.isTemplateCheckerTemplatePageActive?.()) {
    return; // Not a Frontify site, exit early
  }

  // Initialize the progress bar watcher
  watchForFrontifyProgressBar();
}

function watchForFrontifyProgressBar() {
  const processedBars = new WeakSet();

  function ensurePulseStyles() {
    if (document.getElementById(PROGRESS_PULSE_STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = PROGRESS_PULSE_STYLE_ID;
    style.textContent = `
      @keyframes template-checker-progress-pulse {
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

      .${PROGRESS_PULSE_CLASS} {
        border-radius: 10px !important;
        animation: template-checker-progress-pulse 1.6s ease-out infinite;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function injectExtensionButton(progressBar) {
    if (processedBars.has(progressBar)) {
      return;
    }

    const anchorButton = progressBar.querySelector(
      'a[data-test-id="export-progress-bar-anchor-button"]',
    );
    if (!anchorButton?.href) {
      return;
    }

    const downloadButton = progressBar.querySelector(
      'button[aria-label="Download"]',
    );
    let buttonContainer = null;

    if (downloadButton) {
      let parent = downloadButton.parentElement;
      while (parent && parent !== progressBar) {
        if (
          parent.classList.contains("tw-flex") &&
          parent.classList.contains("tw-flex-nowrap") &&
          parent.classList.contains("tw-gap-2")
        ) {
          buttonContainer = parent;
          break;
        }
        parent = parent.parentElement;
      }
    }

    if (!buttonContainer) {
      const allDivs = progressBar.querySelectorAll("div");
      for (let div of allDivs) {
        if (
          div.classList.contains("tw-flex") &&
          div.classList.contains("tw-flex-nowrap") &&
          div.classList.contains("tw-gap-2") &&
          div.querySelector("button")
        ) {
          buttonContainer = div;
          break;
        }
      }
    }

    if (!buttonContainer) {
      return;
    }

    if (
      buttonContainer.querySelector(
        '[data-test-id="extension-check-url-button"]',
      )
    ) {
      processedBars.add(progressBar);
      return;
    }

    const downloadUrl = anchorButton.href;
    const existingButton = progressBar.querySelector(
      'button[data-test-id="fondue-button"]',
    );

    const extensionButton = document.createElement("button");
    extensionButton.type = "button";
    extensionButton.setAttribute("data-test-id", "extension-check-url-button");
    extensionButton.setAttribute("data-variant", "default");
    extensionButton.setAttribute("data-size", "medium");
    extensionButton.setAttribute("data-emphasis", "strong");
    extensionButton.setAttribute("data-rounding", "medium");
    extensionButton.setAttribute("data-aspect", "default");
    extensionButton.setAttribute("data-hug-width", "true");
    extensionButton.setAttribute("aria-label", "Check in Extension");

    if (existingButton?.className) {
      extensionButton.className = existingButton.className;
    }

    extensionButton.style.backgroundColor = "#7C57FF";
    extensionButton.style.color = "white";
    ensurePulseStyles();
    extensionButton.classList.add(PROGRESS_PULSE_CLASS);
    extensionButton.addEventListener("mouseenter", () => {
      extensionButton.style.backgroundColor = "#9A7EFE";
    });
    extensionButton.addEventListener("mouseleave", () => {
      extensionButton.style.backgroundColor = "#7C57FF";
    });

    const buttonText = "Checker";
    extensionButton.textContent = buttonText;

    extensionButton.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      extensionButton.classList.remove(PROGRESS_PULSE_CLASS);

      safeSendMessage({
        action: "frontifyUrlReceived",
        url: downloadUrl,
      })
        .then(() => {
          extensionButton.textContent = "✓ Sent!";
          setTimeout(() => {
            extensionButton.textContent = buttonText;
          }, 2000);
        })
        .catch(() => {});
    });

    const closeButton = buttonContainer.querySelector(
      'button[data-test-id="export-progress-bar-close-button"]',
    );
    if (closeButton?.parentNode) {
      closeButton.parentNode.insertBefore(extensionButton, closeButton);
    } else {
      buttonContainer.appendChild(extensionButton);
    }

    processedBars.add(progressBar);
  }

  const observer = new MutationObserver(() => {
    document
      .querySelectorAll("div.tw-relative.tw-bg-white.tw-pointer-events-auto")
      .forEach((bar) => {
        if (
          bar.querySelector(
            'a[data-test-id="export-progress-bar-anchor-button"]',
          )
        ) {
          setTimeout(() => injectExtensionButton(bar), 100);
        }
      });
  });
  progressBarObserver = observer;

  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      document
        .querySelectorAll("div.tw-relative.tw-bg-white.tw-pointer-events-auto")
        .forEach((bar) => {
          if (
            bar.querySelector(
              'a[data-test-id="export-progress-bar-anchor-button"]',
            )
          ) {
            setTimeout(() => injectExtensionButton(bar), 100);
          }
        });
    }, 1000);
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    });
  }
}

function teardownProgressBar() {
  if (progressBarObserver) {
    progressBarObserver.disconnect();
    progressBarObserver = null;
  }
  clearCheckerButtonPulse();
}

window.addEventListener('template-checker-show', initializeIfFrontifySite);
window.addEventListener('template-checker-hide', teardownProgressBar);

if (window.isTemplateCheckerTemplatePageActive?.()) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeIfFrontifySite, { once: true });
  } else {
    initializeIfFrontifySite();
  }
}
}
})();
