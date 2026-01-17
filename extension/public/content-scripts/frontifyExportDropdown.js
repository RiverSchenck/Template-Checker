// Watch for Frontify export dropdown and modify "InDesign (with changes)" option

function watchForExportDropdown() {
  const processedDropdowns = new WeakSet();

  function injectCustomMenuItem(dropdownContent) {
    if (processedDropdowns.has(dropdownContent)) {
      return;
    }

    const menuItems = dropdownContent.querySelectorAll('[role="menuitem"][data-test-id="export-formats-dropdown-menu-item"]');
    if (menuItems.length === 0) {
      return;
    }

    const indesignMenuItem = Array.from(menuItems).find(item => {
      const text = item.textContent?.trim();
      return text === 'InDesign (with changes)' || text === 'InDesign (with changes) + Checker';
    });

    if (!indesignMenuItem) {
      return;
    }

    const spanElement = indesignMenuItem.querySelector('span');
    if (spanElement && spanElement.textContent.trim() === 'InDesign (with changes)') {
      spanElement.textContent = 'InDesign (with changes) + Checker';
    }

    // Replace the icon with extension icon
    const iconSlot = indesignMenuItem.querySelector('[data-name="left"][data-test-id="fondue-dropdown-slot"]');
    if (iconSlot && typeof chrome !== 'undefined' && chrome.runtime) {
      // Check if we've already replaced it
      const existingImg = iconSlot.querySelector('img[data-extension-icon]');
      if (!existingImg) {
        // Clear existing SVG
        const svg = iconSlot.querySelector('svg');
        if (svg) {
          svg.remove();
        }

        // Create new img element with extension icon
        const iconImg = document.createElement('img');
        iconImg.src = chrome.runtime.getURL('tech-sol48.png');
        iconImg.setAttribute('data-extension-icon', 'true');
        iconImg.style.width = '24px';
        iconImg.style.height = '24px';
        iconImg.style.objectFit = 'contain';
        iconSlot.appendChild(iconImg);
      }
    }

    processedDropdowns.add(dropdownContent);
  }

  function checkAndInject() {
    const dropdownContent = document.querySelector('[data-test-id="fondue-dropdown-content"][role="menu"][data-state="open"]') ||
                            document.querySelector('[data-test-id="fondue-dropdown-content"][role="menu"]');

    if (dropdownContent) {
      const hasMenuItems = dropdownContent.querySelector('[data-test-id="export-formats-dropdown-menu-item"]');
      if (hasMenuItems) {
        injectCustomMenuItem(dropdownContent);
      }
    }
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          if (node.matches?.('[data-test-id="fondue-dropdown-content"]') ||
              node.querySelector?.('[data-test-id="fondue-dropdown-content"]')) {
            setTimeout(checkAndInject, 100);
          }
        }
      });

      if (mutation.type === 'attributes' && mutation.attributeName === 'data-state') {
        const target = mutation.target;
        if (target.matches?.('[data-test-id="fondue-dropdown-content"][role="menu"]') &&
            target.getAttribute('data-state') === 'open') {
          setTimeout(checkAndInject, 100);
        }
      }
    });

    checkAndInject();
  });

  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state']
    });

    setTimeout(checkAndInject, 500);
    setInterval(checkAndInject, 500);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    });
  }
}

watchForExportDropdown();
