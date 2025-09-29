/**
 * @file popup.js
 * @description This script manages all the logic for the extension's popup UI.
 */

// --- Global Element References & Configuration ---
let fontSelect, fontWeightSelect, fontSizeInputElement, lineHeightInputElement;
let letterSpacingInputElement, wordSpacingInputElement; // ADDED: New element references
let btnRtl, btnLtr, resetButton, settingsButton;

/**
 * Configuration object detailing the font-weight capabilities of specific fonts.
 */
const fontsWithWeightSupport = {
  Vazirmatn: { variable: true, min: 100, max: 900, step: 100, default: "" },
  "Noto Sans Arabic": {
    variable: true,
    min: 100,
    max: 900,
    step: 100,
    default: "",
  },
  Cairo: { variable: true, min: 200, max: 1000, step: 100, default: "" },
  Rubik: { variable: true, min: 300, max: 900, step: 100, default: "" },
  "Baloo Bhaijaan 2": {
    variable: true,
    min: 400,
    max: 800,
    step: 100,
    default: "",
  },
  "Playpen Sans": {
    variable: true,
    min: 100,
    max: 900,
    step: 100,
    default: "",
  },
  Roboto: { weights: [100, 300, 400, 500, 700, 900], default: "" },
  "Open Sans": { variable: true, min: 300, max: 800, step: 100, default: "" },
  Inter: { variable: true, min: 100, max: 900, step: 100, default: "" },
  "Noto Sans": {
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    default: "",
  },
  Nunito: { variable: true, min: 200, max: 1000, step: 100, default: "" },
  "Playfair Display": {
    variable: true,
    min: 400,
    max: 900,
    step: 100,
    default: "",
  },
  "Roboto Slab": { variable: true, min: 100, max: 900, step: 100, default: "" },
  "Josefin Sans": {
    variable: true,
    min: 100,
    max: 700,
    step: 100,
    default: "",
  },
  Merriweather: { weights: [300, 400, 700, 900], default: "" },
  "Crimson Text": { weights: [400, 600, 700], default: "" },
  "Roboto Mono": { variable: true, min: 100, max: 700, step: 100, default: "" },
};

/**
 * Configuration for the custom number input steppers.
 */
const numberInputConfig = {
  fontSizeInput: { min: 8, max: 72, step: 1, default: "" },
  lineHeightInput: { min: 0.8, max: 3, step: 0.1, default: "" },
  letterSpacingInput: { min: -5, max: 10, step: 0.1, default: "" },
  wordSpacingInput: { min: -10, max: 30, step: 0.5, default: "" },
};

/**
 * Caches references to frequently used DOM elements.
 */
function initializeDOMElements() {
  fontSelect = document.getElementById("fontSelect");
  fontWeightSelect = document.getElementById("fontWeightSelect");
  fontSizeInputElement = document.getElementById("fontSizeInput");
  lineHeightInputElement = document.getElementById("lineHeightInput");
  letterSpacingInputElement = document.getElementById("letterSpacingInput");
  wordSpacingInputElement = document.getElementById("wordSpacingInput");
  btnRtl = document.getElementById("btnRtl");
  btnLtr = document.getElementById("btnLtr");
  resetButton = document.getElementById("resetButton");
  settingsButton = document.getElementById("settingsButton");
}

/**
 * Populates the main font selector dropdown with options from the global FONT_LIST.
 */
function populateFontSelectDOM(selectElement, selectedValue) {
  if (!selectElement || !window.FONT_LIST || !window.currentTranslations)
    return;
  selectElement.innerHTML = "";

  window.FONT_LIST.forEach((font) => {
    const option = document.createElement("option");
    option.value = font.value;
    option.textContent =
      window.currentTranslations[font.labelKey] || font.value || "Default";
    if (font.value) {
      option.style.fontFamily = `'${font.value}'`;
    } else {
      option.style.fontFamily = "var(--ui-font)";
    }
    if (font.value === selectedValue) {
      option.selected = true;
    }
    selectElement.appendChild(option);
  });

  selectElement.style.fontFamily = selectedValue
    ? `"${selectedValue}", var(--ui-font)`
    : "var(--ui-font)";
}

/**
 * Updates the font weight dropdown's style to preview the selected font and weight.
 */
function updateFontWeightSelectAppearance() {
  if (!fontWeightSelect || !fontSelect) return;
  const selectedFontFamily = fontSelect.value;
  const selectedWeight = fontWeightSelect.value;

  if (
    selectedFontFamily &&
    fontsWithWeightSupport[selectedFontFamily] &&
    selectedWeight
  ) {
    fontWeightSelect.style.fontFamily = `"${selectedFontFamily}", var(--ui-font)`;
    fontWeightSelect.style.fontWeight = selectedWeight;
  } else {
    fontWeightSelect.style.fontFamily = "var(--ui-font)";
    fontWeightSelect.style.fontWeight = "normal";
  }
}

/**
 * Sets the visual 'active' state on the direction buttons.
 */
function updateDirectionButtonsVisualState(activeDirection) {
  if (!btnRtl || !btnLtr) return;
  btnRtl.classList.toggle("active", activeDirection === "rtl");
  btnLtr.classList.toggle("active", activeDirection === "ltr");
}

/**
 * Gets the currently selected text direction from the UI buttons.
 */
function getCurrentSelectedDirection() {
  if (!btnRtl || !btnLtr) return "";
  if (btnRtl.classList.contains("active")) return "rtl";
  if (btnLtr.classList.contains("active")) return "ltr";
  return "";
}

/**
 * Asynchronously retrieves the currently active tab in the current window.
 */
async function getCurrentTab() {
  try {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    return tab;
  } catch (error) {
    console.error("Error getting current tab:", error);
    return null;
  }
}

/**
 * Saves all settings to sync storage and sends them to the content script of the active tab.
 */
async function saveAndApplySettings(
  font,
  direction,
  fontSize,
  lineHeight,
  fontWeight,
  letterSpacing,
  wordSpacing
) {
  const currentTab = await getCurrentTab();
  if (
    !currentTab ||
    !currentTab.url ||
    currentTab.url.startsWith("chrome://") ||
    currentTab.url.startsWith("about:") ||
    currentTab.url.startsWith("edge://")
  ) {
    return;
  }

  let hostname;
  try {
    hostname = new URL(currentTab.url).hostname;
  } catch (e) {
    return;
  }

  const settings = {
    font,
    direction,
    fontSize,
    lineHeight,
    fontWeight,
    letterSpacing,
    wordSpacing,
    host: hostname,
  };

  try {
    await browser.storage.sync.set({ [hostname]: settings });
  } catch (error) {
    console.error("Error saving settings:", error);
    return;
  }

  // --- START: KEY CORRECTION ---
  if (currentTab.id) {
    try {
      await browser.tabs.sendMessage(currentTab.id, {
        action: "applyStyles",
        ...settings,
      });
    } catch (error) {
      console.warn(
        `Could not send message to content script: ${error.message}`
      );
    }
  }
  // --- END: KEY CORRECTION ---
}

/**
 * Applies the specified theme to the popup's body by toggling CSS classes.
 */
window.applyTheme = function (theme) {
  document.body.classList.remove("dark-theme", "light-theme");
  if (theme === "system") {
    const darkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.body.classList.add(darkMode ? "dark-theme" : "light-theme");
  } else if (theme === "dark") {
    document.body.classList.add("dark-theme");
  } else if (theme === "light") {
    document.body.classList.add("light-theme");
  }
};

/**
 * Gathers all current values from the UI controls.
 */
function getCurrentUISettings() {
  return {
    font: fontSelect.value,
    fontWeight: fontWeightSelect.value,
    direction: getCurrentSelectedDirection(),
    fontSize: fontSizeInputElement.value.trim(),
    lineHeight: lineHeightInputElement.value.trim(),
    letterSpacing: letterSpacingInputElement.value.trim(),
    wordSpacing: wordSpacingInputElement.value.trim(),
  };
}

/**
 * Dynamically rebuilds the font-weight dropdown based on the selected font family.
 */
function updateFontWeightSelector(selectedFontName, currentWeightValue) {
  if (!fontWeightSelect || !window.currentTranslations) return;
  fontWeightSelect.innerHTML = `<option value="">${
    window.currentTranslations.browserDefaultOption || "Browser Default"
  }</option>`;
  const fontInfo = fontsWithWeightSupport[selectedFontName];

  if (fontInfo && selectedFontName) {
    fontWeightSelect.disabled = false;
    if (fontInfo.variable) {
      for (let w = fontInfo.min; w <= fontInfo.max; w += fontInfo.step || 100) {
        const option = document.createElement("option");
        option.value = w;
        option.textContent = w;
        option.style.fontFamily = `"${selectedFontName}", var(--ui-font)`;
        option.style.fontWeight = w;
        fontWeightSelect.appendChild(option);
      }
    } else if (fontInfo.weights) {
      fontInfo.weights.forEach((w) => {
        const option = document.createElement("option");
        option.value = w;
        option.textContent = w;
        option.style.fontFamily = `"${selectedFontName}", var(--ui-font)`;
        option.style.fontWeight = w;
        fontWeightSelect.appendChild(option);
      });
    }
    fontWeightSelect.value = currentWeightValue || fontInfo.default || "";
  } else {
    fontWeightSelect.disabled = true;
    fontWeightSelect.value = "";
  }
  updateFontWeightSelectAppearance();
}

/**
 * Adds all necessary event listeners to the UI controls.
 */
function addEventListeners() {
  if (!fontSelect || !resetButton) return;

  document.querySelectorAll(".stepper-btn").forEach((button) => {
    button.addEventListener("click", function () {
      const targetInputId = this.dataset.target;
      const inputElement = document.getElementById(targetInputId);
      if (!inputElement || inputElement.disabled) return;

      const config = numberInputConfig[targetInputId];
      const step = parseFloat(this.dataset.step) || config.step;
      let currentValue = parseFloat(inputElement.value.trim());

      if (isNaN(currentValue) || inputElement.value.trim() === "") {
        let baseValue = targetInputId === "fontSizeInput" ? 16 : 0;
        currentValue = this.classList.contains("stepper-up")
          ? baseValue - step
          : baseValue + step;
      }

      currentValue += this.classList.contains("stepper-up") ? step : -step;

      if (config.min !== undefined && currentValue < config.min)
        currentValue = config.min;
      if (config.max !== undefined && currentValue > config.max)
        currentValue = config.max;

      inputElement.value =
        targetInputId === "fontSizeInput"
          ? Math.round(currentValue)
          : parseFloat(currentValue.toFixed(2));
      const settings = getCurrentUISettings();
      saveAndApplySettings(
        settings.font,
        settings.direction,
        settings.fontSize,
        settings.lineHeight,
        settings.fontWeight,
        settings.letterSpacing,
        settings.wordSpacing
      );
    });
  });

  const allNumberInputs = [
    fontSizeInputElement,
    lineHeightInputElement,
    letterSpacingInputElement,
    wordSpacingInputElement,
  ];

  allNumberInputs.forEach((inputEl) => {
    if (!inputEl) return;
    inputEl.addEventListener("input", function () {
      const settings = getCurrentUISettings();
      saveAndApplySettings(
        settings.font,
        settings.direction,
        settings.fontSize,
        settings.lineHeight,
        settings.fontWeight,
        settings.letterSpacing,
        settings.wordSpacing
      );
    });

    inputEl.addEventListener("change", function () {
      const targetInputId = this.id;
      const config = numberInputConfig[targetInputId];
      let numericValue = parseFloat(this.value.trim());

      if (isNaN(numericValue) || this.value.trim() === "") {
        this.value = config.default;
      } else {
        if (config.min !== undefined && numericValue < config.min)
          numericValue = config.min;
        if (config.max !== undefined && numericValue > config.max)
          numericValue = config.max;
        this.value =
          targetInputId === "fontSizeInput"
            ? Math.round(numericValue)
            : parseFloat(numericValue.toFixed(2));
      }
      const settings = getCurrentUISettings();
      saveAndApplySettings(
        settings.font,
        settings.direction,
        settings.fontSize,
        settings.lineHeight,
        settings.fontWeight,
        settings.letterSpacing,
        settings.wordSpacing
      );
    });
  });

  fontSelect.addEventListener("change", () => {
    const selectedFont = fontSelect.value;
    fontSelect.style.fontFamily = selectedFont
      ? `"${selectedFont}", var(--ui-font)`
      : "var(--ui-font)";
    const fontInfo = fontsWithWeightSupport[selectedFont];
    const defaultWeightForNewFont = fontInfo ? fontInfo.default || "" : "";
    updateFontWeightSelector(selectedFont, defaultWeightForNewFont);
    const settings = getCurrentUISettings();
    saveAndApplySettings(
      settings.font,
      settings.direction,
      settings.fontSize,
      settings.lineHeight,
      settings.fontWeight,
      settings.letterSpacing,
      settings.wordSpacing
    );
  });

  fontWeightSelect.addEventListener("change", () => {
    updateFontWeightSelectAppearance();
    const settings = getCurrentUISettings();
    saveAndApplySettings(
      settings.font,
      settings.direction,
      settings.fontSize,
      settings.lineHeight,
      settings.fontWeight,
      settings.letterSpacing,
      settings.wordSpacing
    );
  });

  btnRtl.addEventListener("click", () => {
    const currentDirection = getCurrentSelectedDirection();
    const newDirection = currentDirection !== "rtl" ? "rtl" : "";
    updateDirectionButtonsVisualState(newDirection);
    const settings = getCurrentUISettings();
    saveAndApplySettings(
      settings.font,
      newDirection,
      settings.fontSize,
      settings.lineHeight,
      settings.fontWeight,
      settings.letterSpacing,
      settings.wordSpacing
    );
  });

  btnLtr.addEventListener("click", () => {
    const currentDirection = getCurrentSelectedDirection();
    const newDirection = currentDirection !== "ltr" ? "ltr" : "";
    updateDirectionButtonsVisualState(newDirection);
    const settings = getCurrentUISettings();
    saveAndApplySettings(
      settings.font,
      newDirection,
      settings.fontSize,
      settings.lineHeight,
      settings.fontWeight,
      settings.letterSpacing,
      settings.wordSpacing
    );
  });

  resetButton.addEventListener("click", () => {
    populateFontSelectDOM(fontSelect, "");
    updateFontWeightSelector("", "");
    fontSizeInputElement.value = numberInputConfig.fontSizeInput.default;
    lineHeightInputElement.value = numberInputConfig.lineHeightInput.default;
    letterSpacingInputElement.value =
      numberInputConfig.letterSpacingInput.default;
    wordSpacingInputElement.value = numberInputConfig.wordSpacingInput.default;
    updateFontWeightSelectAppearance();
    updateDirectionButtonsVisualState("");
    saveAndApplySettings("", "", "", "", "", "", "");
  });

  if (settingsButton) {
    settingsButton.addEventListener("click", () => {
      browser.tabs.create({ url: browser.runtime.getURL("settings.html") });
    });
  }
}

/**
 * Loads saved settings for the current tab and updates the popup UI.
 */
async function loadSavedSettings() {
  if (!fontSelect) initializeDOMElements();

  const currentTab = await getCurrentTab();
  let hostname = null;
  let canInteractWithPage = false;
  const cspWarningElement = document.getElementById("cspWarningMessage");

  if (
    currentTab &&
    currentTab.url &&
    (currentTab.url.startsWith("http") || currentTab.url.startsWith("file"))
  ) {
    try {
      hostname = new URL(currentTab.url).hostname;
      canInteractWithPage = true;
    } catch (e) {}
  }

  if (hostname && cspWarningElement) {
    try {
      const sessionData = await browser.storage.session.get(hostname);
      cspWarningElement.style.display = sessionData[hostname]?.cspBlocked
        ? "flex"
        : "none";
    } catch (e) {
      cspWarningElement.style.display = "none";
    }
  } else if (cspWarningElement) {
    cspWarningElement.style.display = "none";
  }

  const globalData = await browser.storage.sync.get(["uiFont", "theme"]);
  document.documentElement.style.setProperty(
    "--ui-font",
    `"${globalData.uiFont || "Vazirmatn"}"`
  );
  if (typeof window.applyTheme === "function")
    window.applyTheme(globalData.theme || "system");

  let siteSettings = null;
  if (hostname && canInteractWithPage) {
    const siteData = await browser.storage.sync.get(hostname);
    siteSettings = siteData[hostname];
  }

  const currentFont = siteSettings ? siteSettings.font || "" : "";
  const currentWeight = siteSettings ? siteSettings.fontWeight || "" : "";

  populateFontSelectDOM(fontSelect, currentFont);
  updateFontWeightSelector(currentFont, currentWeight);

  fontSizeInputElement.value =
    siteSettings?.fontSize ?? numberInputConfig.fontSizeInput.default;
  lineHeightInputElement.value =
    siteSettings?.lineHeight ?? numberInputConfig.lineHeightInput.default;
  letterSpacingInputElement.value =
    siteSettings?.letterSpacing ?? numberInputConfig.letterSpacingInput.default;
  wordSpacingInputElement.value =
    siteSettings?.wordSpacing ?? numberInputConfig.wordSpacingInput.default;

  updateDirectionButtonsVisualState(
    siteSettings ? siteSettings.direction || "" : ""
  );
  updateFontWeightSelectAppearance();

  const UIElementsToDisable = [
    fontSelect,
    fontWeightSelect,
    fontSizeInputElement,
    lineHeightInputElement,
    letterSpacingInputElement,
    wordSpacingInputElement,
    btnLtr,
    btnRtl,
    resetButton,
  ];
  UIElementsToDisable.forEach((el) => {
    if (el) el.disabled = !canInteractWithPage;
  });
  document
    .querySelectorAll(".stepper-btn")
    .forEach((btn) => (btn.disabled = !canInteractWithPage));

  if (canInteractWithPage) {
    if (!fontsWithWeightSupport[currentFont] || !currentFont) {
      fontWeightSelect.disabled = true;
    }
  } else {
    fontWeightSelect.disabled = true;
  }
}

// --- Main Execution & Event Listeners ---
document.addEventListener("DOMContentLoaded", async () => {
  initializeDOMElements();
  await initI18n();
  await loadSavedSettings();
  addEventListeners();
});

browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === "THEME_CHANGED") {
    if (typeof window.applyTheme === "function")
      window.applyTheme(message.theme);
    sendResponse({ status: "Theme applied to popup." });
    return true;
  }
  return false;
});

browser.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === "sync") {
    let needsReloadForSettings = false;
    const tab = await getCurrentTab();
    let currentHostnameForStorageChange = null;
    if (
      tab &&
      tab.url &&
      (tab.url.startsWith("http") || tab.url.startsWith("file"))
    ) {
      try {
        currentHostnameForStorageChange = new URL(tab.url).hostname;
      } catch (e) {}
    }

    for (let key in changes) {
      if (
        currentHostnameForStorageChange &&
        key === currentHostnameForStorageChange
      ) {
        needsReloadForSettings = true;
      }
      if (key === "extensionLanguage" || key === "theme" || key === "uiFont") {
        needsReloadForSettings = true;
      }
    }

    if (needsReloadForSettings) {
      await initI18n();
      await loadSavedSettings();
    }
  }

  if (namespace === "session") {
    const tab = await getCurrentTab();
    let currentHostnameForStorageChange = null;
    if (
      tab &&
      tab.url &&
      (tab.url.startsWith("http") || tab.url.startsWith("file"))
    ) {
      try {
        currentHostnameForStorageChange = new URL(tab.url).hostname;
      } catch (e) {}
    }
    if (
      currentHostnameForStorageChange &&
      changes[currentHostnameForStorageChange]
    ) {
      await loadSavedSettings();
    }
  }
});

browser.tabs.onActivated.addListener(async (activeInfo) => {
  await initI18n();
  await loadSavedSettings();
});

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const activeTab = await getCurrentTab();
  if (
    activeTab &&
    tabId === activeTab.id &&
    changeInfo.status === "complete" &&
    tab.url
  ) {
    await initI18n();
    await loadSavedSettings();
  }
});
