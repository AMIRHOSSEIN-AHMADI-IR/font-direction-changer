/**
 * @file settings.js
 * @description Manages the settings page for the Font Changer extension.
 * Handles UI interactions, loads and saves settings, manages site-specific configurations,
 * and facilitates import/export/reset functionality.
 */

// --- Constants and Global Scope Variables ---

const storageArea = chrome.storage.sync;
const EXPORT_FILE_NAME = "font_changer_settings_backup.json";
const ALL_SETTINGS_KEY = "fontChangerAllSettingsBackup";
const DEFAULT_UI_FONT = "Vazirmatn";

// DOM element references, initialized in DOMContentLoaded.
let themeSelector, exportButton, importButton, importFileInput;
let siteSearchInput, clearSearchButton, sitesListContainer;
let resetAllSettingsButton, importStatusMessageElement;
let scrollUpBtn, scrollDownBtn;

// State variables.
let currentOpenDetailsHost = null;
let statusMessageTimeoutId = null;

// --- DOM Initialization & Event Listeners ---
document.addEventListener("DOMContentLoaded", async () => {
  // Get all DOM elements first
  themeSelector = document.getElementById("themeSelector");
  exportButton = document.getElementById("exportSettingsButton");
  importButton = document.getElementById("importSettingsButton");
  importFileInput = document.getElementById("importFile");
  siteSearchInput = document.getElementById("siteSearchInput");
  clearSearchButton = document.getElementById("clearSearchButton");
  sitesListContainer = document.getElementById("sitesList");
  resetAllSettingsButton = document.getElementById("resetAllSettingsButton");
  importStatusMessageElement = document.getElementById("importStatusMessage");
  scrollUpBtn = document.getElementById("scrollUpBtn");
  scrollDownBtn = document.getElementById("scrollDownBtn");

  // Initialize i18n first to get translations
  const loadedLang = await initI18n();

  // Setup Custom Selects
  setupCustomSelect("customLanguageSelect", loadedLang, (value) => {
    storageArea.set({ extensionLanguage: value }).then(() => location.reload());
  });

  const globalSettings = await storageArea.get(["uiFont", "theme"]);
  const initialUiFont = globalSettings.uiFont || DEFAULT_UI_FONT;

  setupCustomSelect(
    "customUiFontSelect",
    initialUiFont,
    (value) => {
      storageArea.set({ uiFont: value });
      applyUiFontToSettingsPage(value);
    },
    getFontListAsOptions()
  );

  // Load remaining settings and add listeners
  await loadInitialGlobalSettings(globalSettings);
  await refreshSiteListPage();
  addSettingsEventListeners();
});

function addSettingsEventListeners() {
  themeSelector?.addEventListener("click", handleThemeChange);
  siteSearchInput?.addEventListener("input", filterSites);
  clearSearchButton?.addEventListener("click", () => {
    if (siteSearchInput) {
      siteSearchInput.value = "";
      filterSites();
      siteSearchInput.focus();
    }
  });
  exportButton?.addEventListener("click", handleExportSettings);
  if (importButton && importFileInput) {
    importButton.addEventListener("click", () => importFileInput.click());
    importFileInput.addEventListener("change", handleImportSettings);
  }
  resetAllSettingsButton?.addEventListener("click", handleResetAllSettings);
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener?.("change", () => {
      storageArea.get("theme", (data) => {
        if ((data.theme || "system") === "system") {
          applyThemeToSettingsPage("system");
          updateThemeIndicator(data.theme || "system");
        }
      });
    });
  window.addEventListener("scroll", updateScrollButtonsVisibility, {
    passive: true,
  });
  scrollUpBtn?.addEventListener("click", () =>
    window.scrollTo({ top: 0, behavior: "smooth" })
  );
  scrollDownBtn?.addEventListener("click", () =>
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })
  );
}

// --- Generic Custom Select Logic (Updated) ---
function setupCustomSelect(
  elementId,
  initialValue,
  onSelectCallback,
  optionsArray = null
) {
  const customSelect = document.getElementById(elementId);
  if (!customSelect) return;

  const wrapper = customSelect.closest(".custom-select-wrapper");
  const cardParent = customSelect.closest(".card");
  const selected = customSelect.querySelector(".select-selected");
  const itemsContainer = customSelect.querySelector(".select-items");

  if (optionsArray) {
    itemsContainer.innerHTML = "";
    optionsArray.forEach((option) => {
      const optionDiv = document.createElement("div");
      optionDiv.dataset.value = option.value;
      if (option.style) optionDiv.style.fontFamily = option.style;
      optionDiv.innerHTML = `<span>${option.label}</span>`;
      itemsContainer.appendChild(optionDiv);
    });
  }

  const options = itemsContainer.querySelectorAll("div[data-value]");
  const initialOption = [...options].find(
    (opt) => opt.dataset.value === initialValue
  );

  if (initialOption) {
    selected.innerHTML = initialOption.innerHTML;
    if (initialOption.style.fontFamily) {
      document.documentElement.style.setProperty(
        "--selected-ui-font",
        initialOption.style.fontFamily
      );
    }
  } else if (options.length > 0) {
    // Fallback to the first option if initialValue is invalid
    selected.innerHTML = options[0].innerHTML;
  }

  const closeDropdown = () => {
    customSelect.classList.remove("select-active");
    wrapper?.classList.remove("is-active");
    cardParent?.classList.remove("overflow-visible");
  };

  selected.addEventListener("click", (e) => {
    e.stopPropagation();
    const isActive = customSelect.classList.contains("select-active");

    // Close all other dropdowns first
    document.querySelectorAll(".custom-select.select-active").forEach((sel) => {
      if (sel.id !== elementId) {
        sel.classList.remove("select-active");
        sel.closest(".custom-select-wrapper")?.classList.remove("is-active");
        sel.closest(".card")?.classList.remove("overflow-visible");
      }
    });

    if (isActive) {
      closeDropdown();
    } else {
      customSelect.classList.add("select-active");
      wrapper?.classList.add("is-active");
      cardParent?.classList.add("overflow-visible");
    }
  });

  options.forEach((option) => {
    option.addEventListener("click", function () {
      const value = this.dataset.value;
      selected.innerHTML = this.innerHTML;
      if (this.style.fontFamily) {
        document.documentElement.style.setProperty(
          "--selected-ui-font",
          this.style.fontFamily
        );
      }
      closeDropdown();
      onSelectCallback(value);
    });
  });

  document.addEventListener("click", closeDropdown);
}

function getFontListAsOptions() {
  if (!window.FONT_LIST || !window.currentTranslations) return [];
  // Use map directly on FONT_LIST
  return window.FONT_LIST.map((font) => ({
    value: font.value,
    label: window.currentTranslations[font.labelKey] || font.value || "Default",
    style: font.value ? `'${font.value}'` : "var(--ui-font)",
  }));
}

// --- State-Based Scroll Button Logic ---
function updateScrollButtonsVisibility() {
  const container = scrollUpBtn?.parentElement;
  if (!container) return;
  const scrollTop = window.scrollY;
  const scrollHeight = document.documentElement.scrollHeight;
  const clientHeight = document.documentElement.clientHeight;
  const shouldShowUp = scrollTop > 20;
  const shouldShowDown = scrollHeight - scrollTop - clientHeight > 20;
  let stateClass = "";
  if (shouldShowUp && shouldShowDown) {
    stateClass = "both-visible";
  } else if (shouldShowUp) {
    stateClass = "up-only";
  } else if (shouldShowDown) {
    stateClass = "down-only";
  } else {
    stateClass = "none-visible";
  }
  container.className = "scroll-buttons-container " + stateClass;
}

// --- Theme Selector Logic ---
function updateThemeIndicator(themeValue) {
  if (!themeSelector) return;
  const activeBtn = themeSelector.querySelector(
    `.segmented-btn[data-value="${themeValue}"]`
  );
  const indicator = themeSelector.querySelector(".segmented-indicator");
  if (activeBtn && indicator) {
    const containerRect = themeSelector.getBoundingClientRect();
    const buttonRect = activeBtn.getBoundingClientRect();
    const leftPosition = buttonRect.left - containerRect.left;

    indicator.style.width = `${buttonRect.width}px`;
    indicator.style.transform = `translateX(${leftPosition}px)`;

    themeSelector.querySelectorAll(".segmented-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.value === themeValue);
    });
  }
}

async function handleThemeChange(event) {
  const target = event.target.closest(".segmented-btn");
  if (target?.dataset.value) {
    const theme = target.dataset.value;
    updateThemeIndicator(theme);
    await storageArea.set({ theme });
    applyThemeToSettingsPage(theme);
  }
}

// --- Other Functions ---
function showContextMenu(event, host) {
  event.stopPropagation();
  closeContextMenu();
  const button = event.currentTarget;
  const rect = button.getBoundingClientRect();
  const menu = document.createElement("div");
  menu.className = "context-menu";
  menu.innerHTML = `<button type="button" class="context-menu-item" data-action="open">${
    window.currentTranslations.openSiteButton || "Open Site"
  }</button><button type="button" class="context-menu-item danger" data-action="remove">${
    window.currentTranslations.removeSiteButton || "Remove"
  }</button>`;
  document.body.appendChild(menu);
  let top = rect.bottom + window.scrollY + 4;
  let left = rect.left + window.scrollX;
  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;
  menu.querySelector('[data-action="open"]').addEventListener("click", () => {
    chrome.tabs.create({ url: `https://${host}`, active: true });
    closeContextMenu();
  });
  menu
    .querySelector('[data-action="remove"]')
    .addEventListener("click", async () => {
      await storageArea.remove(host);
      if (host === currentOpenDetailsHost) currentOpenDetailsHost = null;
      closeContextMenu();
    });
  requestAnimationFrame(() => {
    menu.classList.add("visible");
    document.addEventListener("click", closeContextMenu, { once: true });
  });
}
function closeContextMenu() {
  const menu = document.querySelector(".context-menu");
  if (menu) {
    menu.remove();
    document.removeEventListener("click", closeContextMenu);
  }
}

async function loadInitialGlobalSettings(data) {
  try {
    const theme = data.theme || "system";
    applyThemeToSettingsPage(theme);
    updateThemeIndicator(theme);
    const uiFont = data.uiFont || DEFAULT_UI_FONT;
    applyUiFontToSettingsPage(uiFont);
    updateScrollButtonsVisibility();
  } catch (e) {
    console.error("Error loading initial settings:", e);
  }
}

function applyThemeToSettingsPage(theme) {
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.body.classList.toggle("dark-theme", isDark);
  document.body.classList.toggle("light-theme", !isDark);
}

function applyUiFontToSettingsPage(font) {
  document.documentElement.style.setProperty(
    "--ui-font",
    `"${font || DEFAULT_UI_FONT}"`
  );
}

function filterSites() {
  const term = siteSearchInput?.value.toLowerCase().trim() || "";
  sitesListContainer?.querySelectorAll(".site-item").forEach((item) => {
    const host = item.dataset.host?.toLowerCase() || "";
    const isVisible = host.includes(term);
    item.style.display = isVisible ? "" : "none";
  });
  clearSearchButton.style.display = term ? "flex" : "none";
  updateScrollButtonsVisibility();
}

async function refreshSiteListPage() {
  if (!sitesListContainer || !window.currentTranslations) return;
  try {
    const data = await storageArea.get(null);
    const entries = Object.entries(data)
      .filter(
        ([k, v]) =>
          k.includes(".") &&
          typeof v === "object" &&
          v !== null &&
          !["uiFont", "theme", "extensionLanguage", ALL_SETTINGS_KEY].includes(
            k
          )
      )
      .sort(([a], [b]) => a.localeCompare(b));
    buildAndAttachSiteListDOM(sitesListContainer, entries);
    if (
      currentOpenDetailsHost &&
      !entries.some(([h]) => h === currentOpenDetailsHost)
    )
      currentOpenDetailsHost = null;
  } catch (e) {
    console.error("Error refreshing site list:", e);
  }
}

function buildAndAttachSiteListDOM(container, entries) {
  container.innerHTML = "";
  if (entries.length === 0) {
    container.innerHTML = `<p class="no-sites-configured-message">${getLocalizedText(
      "noSitesYetMessage",
      "No sites configured."
    )}</p>`;
  } else {
    const frag = document.createDocumentFragment();
    entries.forEach(([host, settings]) => {
      const item = document.createElement("div");
      item.className = "site-item";
      item.dataset.host = host;
      const header = document.createElement("div");
      header.className = "site-header";
      header.innerHTML = `<span class="site-host">${host}</span>`;
      const kebab = document.createElement("button");
      kebab.className = "kebab-menu-btn";
      kebab.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"></path></svg>`;
      kebab.setAttribute("aria-label", `Actions for ${host}`);
      kebab.addEventListener("click", (e) => showContextMenu(e, host));
      header.appendChild(kebab);
      const details = document.createElement("div");
      details.className = "site-details";
      item.append(header, details);
      header.addEventListener("click", (e) => {
        if (!e.target.closest(".kebab-menu-btn"))
          toggleSiteDetailsDisplay(item, host, settings);
      });
      frag.appendChild(item);
    });
    container.appendChild(frag);
  }
  filterSites();
}

/**
 * Toggles the expanded/collapsed state of a site item's details.
 * UPDATED: Now displays letterSpacing and wordSpacing values.
 * @param {HTMLElement} el - The site item element.
 * @param {string} host - The hostname of the site.
 * @param {object} settings - The settings object for that site.
 */
function toggleSiteDetailsDisplay(el, host, settings) {
  const isExpanded = el.classList.contains("expanded");
  document
    .querySelectorAll(".site-item.expanded")
    .forEach((i) => i.classList.remove("expanded"));
  if (!isExpanded) {
    const details = el.querySelector(".site-details");
    // UPDATED: Added rows for Letter Spacing and Word Spacing.
    details.innerHTML = `<div class="site-detail-item"><span class="detail-label">${getLocalizedText(
      "siteDetailFont",
      "Font:"
    )}</span><span class="detail-value" style="font-family: '${
      settings.font || "var(--ui-font)"
    }';">${getLocalizedFontDisplayName(settings.font)}</span></div>
<div class="site-detail-item"><span class="detail-label">${getLocalizedText(
      "siteDetailWeight",
      "Weight:"
    )}</span><span class="detail-value">${getLocalizedFontWeightLabel(
      settings.fontWeight
    )}</span></div>
<div class="site-detail-item"><span class="detail-label">${getLocalizedText(
      "siteDetailSize",
      "Size:"
    )}</span><span class="detail-value">${getLocalizedFontSizeLabel(
      settings.fontSize
    )}</span></div>
<div class="site-detail-item"><span class="detail-label">${getLocalizedText(
      "siteDetailLineHeight",
      "Line H:"
    )}</span><span class="detail-value">${getLocalizedLineHeightLabel(
      settings.lineHeight
    )}</span></div>
<div class="site-detail-item"><span class="detail-label">${getLocalizedText(
      "siteDetailLetterSpacing",
      "Letter Spacing:"
    )}</span><span class="detail-value">${getLocalizedSpacingLabel(
      settings.letterSpacing
    )}</span></div>
<div class="site-detail-item"><span class="detail-label">${getLocalizedText(
      "siteDetailWordSpacing",
      "Word Spacing:"
    )}</span><span class="detail-value">${getLocalizedSpacingLabel(
      settings.wordSpacing
    )}</span></div>
<div class="site-detail-item"><span class="detail-label">${getLocalizedText(
      "siteDetailDirection",
      "Direction:"
    )}</span><span class="detail-value">${getLocalizedDirectionLabel(
      settings.direction
    )}</span></div>`;
    el.classList.add("expanded");
    currentOpenDetailsHost = host;
  } else {
    currentOpenDetailsHost = null;
  }
}

// --- Localization Helpers ---
function getLocalizedText(key, fallback) {
  return window.currentTranslations?.[key] || fallback;
}
function getLocalizedFontDisplayName(val) {
  const font = window.FONT_LIST?.find((f) => f.value === val);
  return getLocalizedText(
    font?.labelKey,
    val || getLocalizedText("defaultOption", "Default")
  );
}
function getLocalizedDirectionLabel(val) {
  if (val === "rtl") return getLocalizedText("rtlButton", "RTL");
  if (val === "ltr") return getLocalizedText("ltrButton", "LTR");
  return getLocalizedText("defaultOption", "Default");
}
function getLocalizedFontSizeLabel(val) {
  return val ? `${val}px` : getLocalizedText("defaultOption", "Default");
}
function getLocalizedLineHeightLabel(val) {
  return val || getLocalizedText("defaultOption", "Default");
}
/**
 * ADDED: Helper function to format spacing values for display.
 * @param {string|number} val - The spacing value.
 * @returns {string} The formatted value with "px" or a default string.
 */
function getLocalizedSpacingLabel(val) {
  if (val == null || val === "") {
    return getLocalizedText("defaultOption", "Default");
  }
  return `${val}px`;
}
function getLocalizedFontWeightLabel(val) {
  if (!val || val === "normal" || val === "400")
    return getLocalizedText("fontWeightNormal", "Normal");
  if (val === "bold" || val === "700")
    return getLocalizedText("fontWeightBold", "Bold");
  return val;
}

function displayStatusMessage(
  key,
  type = "",
  duration = 5000,
  placeholders = null
) {
  if (!importStatusMessageElement) return;
  clearTimeout(statusMessageTimeoutId);
  let text = getLocalizedText(key, key);
  if (placeholders) {
    for (const p in placeholders) {
      text = text.replace(`$${p.toUpperCase()}$`, placeholders[p]);
    }
  }
  importStatusMessageElement.textContent = text;
  importStatusMessageElement.className = `status-message visible ${type}`;
  if (duration > 0)
    statusMessageTimeoutId = setTimeout(() => {
      importStatusMessageElement.className = "status-message";
    }, duration);
}

async function handleExportSettings() {
  try {
    const data = await storageArea.get(null);
    const exportData = Object.fromEntries(
      Object.entries(data).filter(
        ([key]) =>
          key.includes(".") ||
          ["uiFont", "theme", "extensionLanguage"].includes(key)
      )
    );
    if (Object.keys(exportData).length === 0) {
      displayStatusMessage("exportNoSettingsMessage");
      return;
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = EXPORT_FILE_NAME;
    a.click();
    URL.revokeObjectURL(url);
    displayStatusMessage("exportSuccessMessage", "success");
  } catch (e) {
    displayStatusMessage("exportErrorMessage", "error");
  }
}

async function handleImportSettings(event) {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    const settings = JSON.parse(text);
    await storageArea.set(settings);
    location.reload();
  } catch (e) {
    displayStatusMessage("importErrorMessage", "error", 7000, {
      ERROR: e.message,
    });
  } finally {
    event.target.value = null;
  }
}

async function handleResetAllSettings() {
  if (
    !confirm(
      getLocalizedText("confirmResetAllSettingsMessage", "Are you sure?")
    )
  )
    return;
  try {
    await storageArea.clear();
    await storageArea.set({
      theme: "system",
      uiFont: DEFAULT_UI_FONT,
      extensionLanguage: "en",
    });
    location.reload();
  } catch (e) {
    displayStatusMessage("resetAllSettingsErrorMessage", "error", 7000, {
      ERROR: e.message,
    });
  }
}

// --- Chrome API Listeners ---
chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === "THEME_CHANGED") {
    applyThemeToSettingsPage(msg.theme);
    updateThemeIndicator(msg.theme || "system");
  }
  if (msg.type === "SITE_DATA_DID_CHANGE_FORWARDED") {
    await refreshSiteListPage();
  }
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "sync") return;
  let refreshList = false;
  let uiFontChanged = false;

  for (const key in changes) {
    if (key === "extensionLanguage") {
      location.reload();
      return;
    }
    if (key === "uiFont") {
      uiFontChanged = true;
    }
    if (key.includes(".")) {
      refreshList = true;
    }
  }

  if (uiFontChanged) {
    const newFont = changes.uiFont.newValue || DEFAULT_UI_FONT;
    applyUiFontToSettingsPage(newFont);
    // Also update the custom select if it exists
    const fontSelect = document.getElementById("customUiFontSelect");
    if (fontSelect) {
      const newOption = fontSelect.querySelector(
        `.select-items div[data-value="${newFont}"]`
      );
      if (newOption) {
        fontSelect.querySelector(".select-selected").innerHTML =
          newOption.innerHTML;
        document.documentElement.style.setProperty(
          "--selected-ui-font",
          newOption.style.fontFamily
        );
      }
    }
  }

  if (refreshList) {
    await refreshSiteListPage();
  }
});
