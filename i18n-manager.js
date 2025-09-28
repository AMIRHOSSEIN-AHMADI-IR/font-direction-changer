/**
 * @file i18n-manager.js
 * @description Manages the internationalization (i18n) of the extension's UI.
 * This script dynamically loads language files, applies translated strings to the DOM,
 * and handles Right-To-Left (RTL) and Left-To-Right (LTR) layout adjustments.
 */

// --- Constants and Global State ---

// The default language to use if no preference is set or if a language file fails to load.
const DEFAULT_LANG = "en";

// A global variable to hold the currently active language code.
window.currentLanguageCode = DEFAULT_LANG;

// --- Core Functions ---

/**
 * Dynamically loads a language-specific JavaScript file.
 * These files are expected to define a global `window.currentTranslations` object.
 * @param {string} langCode - The two-letter code for the language to load (e.g., 'en', 'fa').
 * @returns {Promise<void>} A promise that resolves when the script is loaded and the
 *                          translations object is verified, or rejects on error.
 */
async function loadLanguageFile(langCode) {
  return new Promise((resolve, reject) => {
    // Remove any previously loaded language script to prevent conflicts.
    const existingScript = document.getElementById("dynamicLanguageScript");
    if (existingScript) {
      existingScript.remove();
    }

    // Create a new script element to load the language file.
    const script = document.createElement("script");
    script.id = "dynamicLanguageScript";
    script.src = chrome.runtime.getURL(`locales_js/${langCode}.js`);

    // Handle successful script loading.
    script.onload = () => {
      // Verify that the script correctly populated the global translations object.
      if (
        window.currentTranslations &&
        typeof window.currentTranslations === "object"
      ) {
        window.currentLanguageCode = langCode;
        resolve();
      } else {
        const loadErrorMsg = `Translations object (window.currentTranslations) was not properly set by ${langCode}.js.`;
        reject(new Error(loadErrorMsg));
      }
    };

    // Handle errors during script loading (e.g., file not found).
    script.onerror = (event) => {
      const errorMsg = `Error loading language file: ${script.src}`;
      // If the failed language was not the default, attempt to fall back to the default language.
      if (langCode !== DEFAULT_LANG) {
        console.warn(
          `Falling back to default language ('${DEFAULT_LANG}') due to error.`
        );
        window.currentLanguageCode = DEFAULT_LANG;
        loadLanguageFile(DEFAULT_LANG)
          .then(resolve)
          .catch((finalError) => {
            console.error(
              `CRITICAL: Fallback to '${DEFAULT_LANG}' also failed.`,
              finalError
            );
            reject(finalError);
          });
      } else {
        // If the default language itself fails, it's a critical error.
        console.error(
          `CRITICAL: Default language file '${DEFAULT_LANG}.js' failed to load.`
        );
        reject(new Error(errorMsg));
      }
    };

    // Append the script to the head to initiate loading.
    (document.head || document.documentElement).appendChild(script);
  });
}

/**
 * Scans the DOM and applies translations from the `window.currentTranslations` object.
 */
function applyTranslations() {
  if (!window.currentTranslations) {
    console.warn("applyTranslations called, but no translations are loaded.");
    return;
  }

  // --- 1. Handle elements with `data-i18n-key` for textContent or other attributes ---
  document.querySelectorAll("[data-i18n-key]").forEach((el) => {
    const key = el.getAttribute("data-i18n-key");
    const targetAttr = el.getAttribute("data-i18n-target"); // e.g., 'title'
    let translation = window.currentTranslations[key];

    if (typeof translation === "undefined") return; // Skip if key not found.

    // Handle placeholders like $PLACEHOLDER$ in the translation string.
    const placeholdersData = el.dataset.i18nPlaceholders;
    if (placeholdersData) {
      try {
        const placeholders = JSON.parse(placeholdersData);
        for (const placeholderKey in placeholders) {
          const regex = new RegExp(
            `\\$${placeholderKey
              .toUpperCase()
              .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\$`,
            "g"
          );
          translation = translation.replace(
            regex,
            placeholders[placeholderKey]
          );
        }
      } catch (e) {
        console.error("Error parsing i18n placeholders JSON for key:", key, e);
      }
    }

    // Apply the translation to the specified attribute or to textContent by default.
    if (targetAttr) {
      el.setAttribute(targetAttr, translation);
    } else {
      el.textContent = translation;
    }
  });

  // --- 2. Handle specific attributes like placeholder, title, and aria-label ---
  const attributeMap = {
    "data-i18n-placeholder-key": "placeholder",
    "data-i18n-title-key": "title",
    "data-i18n-aria-label-key": "aria-label",
  };

  for (const dataAttrKey in attributeMap) {
    document.querySelectorAll(`[${dataAttrKey}]`).forEach((el) => {
      const translationKey = el.getAttribute(dataAttrKey);
      const targetHtmlAttr = attributeMap[dataAttrKey];
      const translation = window.currentTranslations[translationKey];
      if (typeof translation !== "undefined") {
        el.setAttribute(targetHtmlAttr, translation);
      }
    });
  }

  // --- 3. Handle the document's main <title> element ---
  const titleElement = document.querySelector("head > title[data-i18n-key]");
  if (titleElement) {
    const titleKey = titleElement.getAttribute("data-i18n-key");
    if (window.currentTranslations[titleKey]) {
      document.title = window.currentTranslations[titleKey];
    }
  }

  // --- 4. Handle RTL/LTR layout adjustments ---
  const rtlLanguages = ["fa", "ar"];
  if (rtlLanguages.includes(window.currentLanguageCode)) {
    document.documentElement.setAttribute("dir", "rtl");
    document.body.setAttribute("dir", "rtl");
    document.body.classList.add("lang-rtl");
    document.body.classList.remove("lang-ltr");
  } else {
    document.documentElement.setAttribute("dir", "ltr");
    document.body.setAttribute("dir", "ltr");
    document.body.classList.add("lang-ltr");
    document.body.classList.remove("lang-rtl");
  }
}

/**
 * Initializes the internationalization process.
 * It determines which language to load from storage, loads the corresponding
 * language file, and then applies the translations to the page.
 * @returns {Promise<string>} A promise that resolves with the language code that was loaded.
 */
async function initI18n() {
  let langToLoad = DEFAULT_LANG;
  try {
    // Attempt to get the user's preferred language from sync storage.
    const data = await chrome.storage.sync.get("extensionLanguage");
    if (data.extensionLanguage) {
      langToLoad = data.extensionLanguage;
    }
    // Load the determined language and apply translations.
    await loadLanguageFile(langToLoad);
    applyTranslations();
    return window.currentLanguageCode;
  } catch (error) {
    // If anything fails (e.g., storage access, loading the preferred language),
    // fall back to the default language as a safety measure.
    console.error(
      `Error during i18n initialization, falling back to '${DEFAULT_LANG}'.`,
      error
    );
    try {
      await loadLanguageFile(DEFAULT_LANG);
      applyTranslations();
      return window.currentLanguageCode;
    } catch (defaultLangError) {
      // If even the default language fails, log a critical error. The UI will be untranslated.
      console.error(
        "CRITICAL: Failed to load default language after an initial error:",
        defaultLangError
      );
      // Ensure a default LTR layout is applied to prevent a broken UI state.
      document.documentElement.setAttribute("dir", "ltr");
      document.body.setAttribute("dir", "ltr");
      document.body.classList.add("lang-ltr");
      document.body.classList.remove("lang-rtl");
      return DEFAULT_LANG;
    }
  }
}
