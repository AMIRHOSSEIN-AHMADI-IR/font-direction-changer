/**
 * @file runtime.js
 * @description The service worker for the Font Changer extension.
 * It acts as a central event bus, listening for messages from different parts
 * of the extension (like the popup and settings page) and for changes in
 * browser.storage.sync. Its primary role is to ensure that all views
 * (popup, settings page, content scripts) are synchronized with the latest data.
 */

/**
 * Listens for messages sent from other parts of the extension.
 * This is the primary hub for direct communication between scripts.
 */
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "USER_CHANGED_THEME_PREFERENCE") {
    const newTheme = message.theme;
    browser.runtime
      .sendMessage({ type: "THEME_CHANGED", theme: newTheme })
      .catch((e) =>
        console.warn(
          "[Service Worker] Error broadcasting THEME_CHANGED:",
          e.message
        )
      );
    return true;
  }

  if (message.type === "SITE_DATA_DID_CHANGE") {
    browser.runtime
      .sendMessage({ type: "SITE_DATA_DID_CHANGE_FORWARDED" })
      .catch((e) =>
        console.warn(
          "[Service Worker] Error forwarding SITE_DATA_DID_CHANGE:",
          e.message
        )
      );
    return true;
  }

  if (message.type === "SETTINGS_IMPORTED_SUCCESSFULLY") {
    browser.runtime
      .sendMessage({ type: "RELOAD_POPUP_SETTINGS" })
      .catch((e) =>
        console.warn("Error telling popup to reload after import:", e.message)
      );
    sendResponse({
      status: "Import notification processed by service worker.",
    });
    return true;
  }

  return false;
});

/**
 * Listens for any changes made to browser.storage.
 * This is the most reliable way to detect data changes.
 */
browser.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync") {
    let siteDataWasAltered = false;
    for (const key in changes) {
      if (key === "theme") {
        if (changes[key].newValue !== changes[key].oldValue) {
          browser.runtime
            .sendMessage({
              type: "THEME_CHANGED",
              theme: changes[key].newValue,
            })
            .catch((e) =>
              console.warn(
                "Error sending THEME_CHANGED from storage listener:",
                e
              )
            );
        }
      } else if (key.includes(".") && key !== "fontChangerAllSettingsBackup") {
        const change = changes[key];
        if (
          (change.newValue && typeof change.newValue === "object") ||
          (change.oldValue && typeof change.newValue === "undefined")
        ) {
          siteDataWasAltered = true;
        }
      }
    }

    if (siteDataWasAltered) {
      browser.runtime
        .sendMessage({ type: "SITE_DATA_DID_CHANGE" })
        .catch((error) => {
          console.error(
            "[Service Worker] CRITICAL ERROR sending SITE_DATA_DID_CHANGE message:",
            error.message
          );
        });
    }
  }
});

/**
 * [ADDED] Ensures styles are applied when a tab finishes loading.
 * This is a robust fallback mechanism to fix the initial load problem.
 */
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    (tab.url.startsWith("http") || tab.url.startsWith("file"))
  ) {
    try {
      const hostname = new URL(tab.url).hostname;
      const data = await browser.storage.sync.get(hostname);
      const settings = data[hostname];

      if (settings) {
        // Send a message to the content script in the updated tab to apply styles.
        // We wrap this in a try-catch because the content script might not be ready
        // on certain pages (e.g., browser's internal pages), which would throw an error.
        try {
          await browser.tabs.sendMessage(tabId, {
            action: "applyStyles",
            font: settings.font,
            direction: settings.direction,
            fontSize: settings.fontSize,
            lineHeight: settings.lineHeight,
            fontWeight: settings.fontWeight,
            letterSpacing: settings.letterSpacing,
            wordSpacing: settings.wordSpacing,
          });
        } catch (error) {
          // This error is often expected on pages where content scripts can't run.
          if (!error.message.includes("Could not establish connection")) {
            console.warn(
              `[Service Worker] Could not apply styles to tab ${tabId}: ${error.message}`
            );
          }
        }
      }
    } catch (error) {
      console.error(
        "[Service Worker] Error in tabs.onUpdated listener:",
        error
      );
    }
  }
});
