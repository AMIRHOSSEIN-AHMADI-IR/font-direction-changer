/**
 * @file runtime.js
 * @description The service worker for the Font Changer extension.
 * It acts as a central event bus, listening for messages from different parts
 * of the extension (like the popup and settings page) and for changes in
 * chrome.storage.sync. Its primary role is to ensure that all views
 * (popup, settings page, content scripts) are synchronized with the latest data.
 */

/**
 * Listens for messages sent from other parts of the extension.
 * This is the primary hub for direct communication between scripts.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle when the user changes the theme from the popup.
  if (message.type === "USER_CHANGED_THEME_PREFERENCE") {
    const newTheme = message.theme;
    // Broadcast a generic "THEME_CHANGED" message to all parts of the extension.
    chrome.runtime
      .sendMessage({ type: "THEME_CHANGED", theme: newTheme })
      .catch((e) =>
        console.warn(
          "[Service Worker] Error broadcasting THEME_CHANGED:",
          e.message
        )
      );
    // Return true to indicate that we will send a response asynchronously,
    // although in this case we are not. It's good practice.
    return true;
  }

  // Handle when site-specific data has been changed (e.g., in the popup).
  if (message.type === "SITE_DATA_DID_CHANGE") {
    // Forward this message to other views, particularly the settings page,
    // so it can refresh its list of configured sites.
    chrome.runtime
      .sendMessage({ type: "SITE_DATA_DID_CHANGE_FORWARDED" })
      .catch((e) =>
        console.warn(
          "[Service Worker] Error forwarding SITE_DATA_DID_CHANGE:",
          e.message
        )
      );
    return true;
  }

  // This message type would be used after a successful settings import.
  if (message.type === "SETTINGS_IMPORTED_SUCCESSFULLY") {
    // Send a message to the popup, telling it to reload its settings.
    chrome.runtime
      .sendMessage({ type: "RELOAD_POPUP_SETTINGS" })
      .catch((e) =>
        console.warn("Error telling popup to reload after import:", e.message)
      );

    // Note: Active tabs will automatically re-apply styles because their
    // content scripts are listening to the `chrome.storage.onChanged` event.
    // Explicitly messaging them is often not necessary unless an immediate,
    // forced refresh is desired. The onChanged listener is more robust.
    sendResponse({
      status: "Import notification processed by service worker.",
    });
    return true;
  }

  // Return false if the message was not handled by this listener.
  return false;
});

/**
 * Listens for any changes made to chrome.storage.
 * This is the most reliable way to detect data changes, as it captures updates
 * from the popup, the settings page, and even from other devices via sync.
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
  // We only care about the 'sync' storage area.
  if (areaName === "sync") {
    let siteDataWasAltered = false;

    // Iterate over all the keys that were changed.
    for (const key in changes) {
      // Check for theme changes.
      if (key === "theme") {
        if (changes[key].newValue !== changes[key].oldValue) {
          // If the theme value actually changed, broadcast the change.
          chrome.runtime
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
      }
      // Identify site-specific settings. A simple way is to check if the key contains a dot.
      // This also excludes the backup key.
      else if (key.includes(".") && key !== "fontChangerAllSettingsBackup") {
        const change = changes[key];
        // A change is considered an alteration if a new site object is added,
        // or an old one is removed (newValue is undefined).
        if (
          (change.newValue && typeof change.newValue === "object") ||
          (change.oldValue && typeof change.newValue === "undefined")
        ) {
          siteDataWasAltered = true;
        }
      }
    }

    // If any site-specific data was added, removed, or changed,
    // send a single message to notify relevant parts of the extension.
    if (siteDataWasAltered) {
      chrome.runtime
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
