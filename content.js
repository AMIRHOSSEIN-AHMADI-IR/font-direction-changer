/**
 * @file content.js
 * @description This script is injected into every webpage to apply font and style overrides.
 */

// --- Constants and Global State ---
const STYLE_OVERRIDE_TAG_ID = "font-direction-changer-style-override";
const FONT_LINK_TAG_ID = "font-direction-changer-font-link";
const storageArea = browser.storage.sync;
const sessionStore = browser.storage.session;

// Caches the last applied settings to be used by the MutationObserver.
let currentAppliedFont = null;
let currentAppliedDirection = null;
let currentAppliedFontSize = null;
let currentAppliedLineHeight = null;
let currentAppliedFontWeight = null;
let currentAppliedLetterSpacing = null;
let currentAppliedWordSpacing = null;

let observer = null;
let mutationDebounceTimeout = null;

/**
 * [MODIFIED] Removes the old font link and creates a new one.
 * This is a more robust method than just updating the href, ensuring
 * the new font is fetched and applied immediately without a page refresh.
 */
function loadGoogleFont(fontName, fontWeight) {
  const head = document.head || document.documentElement;
  const hostname = window.location.hostname;

  // 1. Always remove the existing font link tag to ensure a clean slate.
  const existingLink = document.getElementById(FONT_LINK_TAG_ID);
  if (existingLink) {
    existingLink.remove();
  }

  // 2. If no font is selected or it's a system font, we are done.
  if (!fontName) {
    sessionStore.remove(hostname);
    return;
  }
  const systemFonts = ["Tahoma", "Arial", "Times New Roman", "Georgia"];
  if (systemFonts.includes(fontName)) {
    sessionStore.remove(hostname);
    return;
  }

  // 3. Build the new Google Fonts URL.
  let urlFontName = fontName.replace(/ /g, "+");
  let googleFontUrl = `https://fonts.googleapis.com/css2?family=${urlFontName}`;
  let weightParam = "";
  if (fontWeight && fontWeight.trim() !== "") {
    const variableFontsFullRange = {
      Vazirmatn: "100..900",
      "Noto Sans Arabic": "100..900",
      Montserrat: "100..900",
      Cairo: "200..1000",
      Nunito: "200..1000",
      Tajawal: "200..900",
      "Open Sans": "300..800",
      Changa: "200..800",
    };
    const specificWeightsFonts = {
      Roboto: "100;300;400;500;700;900",
      Lato: "100;300;400;700;900",
      Almarai: "300;400;700;800",
    };
    if (variableFontsFullRange[fontName]) {
      weightParam = `:wght@${variableFontsFullRange[fontName]}`;
    } else if (specificWeightsFonts[fontName]) {
      weightParam = `:wght@${specificWeightsFonts[fontName]}`;
    } else if (!isNaN(parseInt(fontWeight))) {
      weightParam = `:wght@${fontWeight}`;
    }
  }
  if (weightParam) googleFontUrl += weightParam;
  googleFontUrl += (googleFontUrl.includes("?") ? "&" : "?") + "display=swap";

  // 4. Create and append the new link tag.
  const linkElement = document.createElement("link");
  linkElement.id = FONT_LINK_TAG_ID;
  linkElement.rel = "stylesheet";
  linkElement.type = "text/css";
  linkElement.href = googleFontUrl;

  linkElement.onload = () => {
    // Font loaded successfully, clear any CSP warning flags.
    sessionStore.remove(hostname);
  };
  linkElement.onerror = () => {
    // Font loading failed, likely due to CSP.
    console.warn(
      `[FontChanger] Font loading blocked by site policy (CSP) or network error: ${fontName}`
    );
    sessionStore.set({ [hostname]: { cspBlocked: true } });
  };

  head.appendChild(linkElement);
}

function getAllShadowRoots(element = document.documentElement) {
  const roots = new Set();
  const elementsToProcess = [element];
  while (elementsToProcess.length > 0) {
    const currentElement = elementsToProcess.shift();
    if (
      currentElement &&
      currentElement.shadowRoot &&
      !roots.has(currentElement.shadowRoot)
    ) {
      roots.add(currentElement.shadowRoot);
      try {
        elementsToProcess.push(
          ...currentElement.shadowRoot.querySelectorAll("*")
        );
      } catch (e) {}
    }
    if (currentElement && currentElement.children) {
      elementsToProcess.push(...Array.from(currentElement.children));
    }
  }
  return Array.from(roots);
}

function applyStylesToRoot(
  rootNode,
  font,
  direction,
  fontSize,
  lineHeight,
  fontWeight,
  letterSpacing,
  wordSpacing
) {
  const randomSuffix = Math.random().toString(36).substring(2, 9);
  let styleElementIdSuffix =
    rootNode instanceof ShadowRoot && rootNode.host
      ? (rootNode.host.id || rootNode.host.tagName || "shadow") +
        "-" +
        randomSuffix
      : "document";
  const currentStyleElementId =
    `${STYLE_OVERRIDE_TAG_ID}-${styleElementIdSuffix}`
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "-");

  let styleElement = rootNode.querySelector(`#${currentStyleElementId}`);
  let cssRules = "";
  let baseElementStyles = "";
  let formElementFontStyles = "";

  if (font)
    baseElementStyles += `font-family: "${font}", Tahoma, sans-serif !important;`;
  if (fontWeight) baseElementStyles += `font-weight: ${fontWeight} !important;`;
  if (fontSize) baseElementStyles += `font-size: ${fontSize}px !important;`;
  if (lineHeight) baseElementStyles += `line-height: ${lineHeight} !important;`;
  if (letterSpacing)
    baseElementStyles += `letter-spacing: ${letterSpacing}px !important;`;
  if (wordSpacing)
    baseElementStyles += `word-spacing: ${wordSpacing}px !important;`;

  if (font)
    formElementFontStyles += `font-family: "${font}", Tahoma, sans-serif !important;`;
  if (fontWeight)
    formElementFontStyles += `font-weight: ${fontWeight} !important;`;

  if (baseElementStyles) {
    const excludeSelectorsList = [
      '[class*="icon"]',
      '[class*="fa"]',
      "i",
      ".material-icons",
      ".material-symbols-outlined",
      "pre",
      "code",
      "samp",
      "kbd",
    ];
    const excludeCssSelector = excludeSelectorsList
      .map((selector) => `:not(${selector})`)
      .join("");
    cssRules += ` :host ${excludeCssSelector}, * ${excludeCssSelector} { ${baseElementStyles} } `;
    if (rootNode === document.head) {
      cssRules += ` body ${excludeCssSelector} { ${baseElementStyles} } `;
    }
  }

  if (formElementFontStyles) {
    cssRules += ` input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]), textarea, select { ${formElementFontStyles} } `;
  }

  if (direction === "rtl" || direction === "ltr") {
    const textAlign = direction === "rtl" ? "right" : "left";
    cssRules += ` :host, * { direction: ${direction} !important; } `;
    const textAlignSelectors = [
      "body",
      ":host",
      "div",
      "p",
      "section",
      "article",
      "main",
      "header",
      "footer",
      "nav",
      "aside",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "li",
      "ul",
      "ol",
      "td",
      "th",
      "label",
      "input",
      "textarea",
    ];
    const targetedTextAlignSelector = textAlignSelectors
      .map(
        (sel) =>
          `${sel}:not([style*="text-align:center"]):not([align="center"])`
      )
      .join(", ");
    if (targetedTextAlignSelector)
      cssRules += ` ${targetedTextAlignSelector} { text-align: ${textAlign} !important; } `;
  }

  if (cssRules) {
    if (!styleElement) {
      styleElement = document.createElement("style");
      styleElement.id = currentStyleElementId;
      styleElement.setAttribute("type", "text/css");
      rootNode.insertBefore(styleElement, rootNode.firstChild);
    }
    if (styleElement.textContent !== cssRules)
      styleElement.textContent = cssRules;
  } else {
    if (styleElement) styleElement.remove();
  }
}

function applyPageStyles(
  requestedFont,
  requestedDirection,
  requestedFontSize,
  requestedLineHeight,
  requestedFontWeight,
  requestedLetterSpacing,
  requestedWordSpacing
) {
  currentAppliedFont = requestedFont;
  currentAppliedDirection = requestedDirection;
  currentAppliedFontSize = requestedFontSize;
  currentAppliedLineHeight = requestedLineHeight;
  currentAppliedFontWeight = requestedFontWeight;
  currentAppliedLetterSpacing = requestedLetterSpacing;
  currentAppliedWordSpacing = requestedWordSpacing;

  loadGoogleFont(requestedFont, requestedFontWeight);

  applyStylesToRoot(
    document.head,
    requestedFont,
    requestedDirection,
    requestedFontSize,
    requestedLineHeight,
    requestedFontWeight,
    requestedLetterSpacing,
    requestedWordSpacing
  );
  getAllShadowRoots(document.documentElement).forEach((shadowRoot) => {
    applyStylesToRoot(
      shadowRoot,
      requestedFont,
      requestedDirection,
      requestedFontSize,
      requestedLineHeight,
      requestedFontWeight,
      requestedLetterSpacing,
      requestedWordSpacing
    );
  });

  if (requestedDirection) {
    document.documentElement.setAttribute("dir", requestedDirection);
    if (document.body) document.body.setAttribute("dir", requestedDirection);
    getAllShadowRoots(document.documentElement).forEach((root) =>
      root.host?.setAttribute("dir", requestedDirection)
    );
  } else {
    document.documentElement.removeAttribute("dir");
    if (document.body) document.body.removeAttribute("dir");
    getAllShadowRoots(document.documentElement).forEach((root) =>
      root.host?.removeAttribute("dir")
    );
  }
}

function resetPageStyles() {
  currentAppliedFont = null;
  currentAppliedDirection = null;
  currentAppliedFontSize = null;
  currentAppliedLineHeight = null;
  currentAppliedFontWeight = null;
  currentAppliedLetterSpacing = null;
  currentAppliedWordSpacing = null;

  loadGoogleFont(null, null);
  applyStylesToRoot(document.head, null, null, "", "", "", null, null);

  document.documentElement.removeAttribute("dir");
  if (document.body) document.body.removeAttribute("dir");

  getAllShadowRoots(document.documentElement).forEach((shadowRoot) => {
    applyStylesToRoot(shadowRoot, null, null, "", "", "", null, null);
    if (shadowRoot.host) shadowRoot.host.removeAttribute("dir");
  });
}

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "applyStyles") {
    applyPageStyles(
      request.font,
      request.direction,
      request.fontSize,
      request.lineHeight,
      request.fontWeight,
      request.letterSpacing,
      request.wordSpacing
    );
    sendResponse({ status: "Styles received." });
    return true;
  }
  if (request.action === "resetStyles") {
    resetPageStyles();
    sendResponse({ status: "Styles reset." });
    return true;
  }
  return false;
});

async function loadAndApplyInitialStyles() {
  try {
    const data = await storageArea.get(null);
    const hostname = window.location.hostname;
    const settings = data[hostname];

    if (
      settings &&
      (settings.font ||
        settings.direction ||
        settings.fontSize ||
        settings.lineHeight ||
        settings.fontWeight ||
        settings.letterSpacing ||
        settings.wordSpacing)
    ) {
      applyPageStyles(
        settings.font,
        settings.direction,
        settings.fontSize,
        settings.lineHeight,
        settings.fontWeight,
        settings.letterSpacing,
        settings.wordSpacing
      );
    } else {
      currentAppliedFont = null;
      currentAppliedDirection = null;
      currentAppliedFontSize = null;
      currentAppliedLineHeight = null;
      currentAppliedFontWeight = null;
      currentAppliedLetterSpacing = null;
      currentAppliedWordSpacing = null;
    }
  } catch (error) {
    console.error("[FontChanger] Error loading initial styles:", error);
  } finally {
    startObservingDOM();
  }
}

function handleMutations(mutationsList, obs) {
  clearTimeout(mutationDebounceTimeout);
  mutationDebounceTimeout = setTimeout(() => {
    if (
      currentAppliedFont ||
      currentAppliedDirection ||
      currentAppliedFontSize ||
      currentAppliedLineHeight ||
      currentAppliedFontWeight ||
      currentAppliedLetterSpacing ||
      currentAppliedWordSpacing
    ) {
      applyPageStyles(
        currentAppliedFont,
        currentAppliedDirection,
        currentAppliedFontSize,
        currentAppliedLineHeight,
        currentAppliedFontWeight,
        currentAppliedLetterSpacing,
        currentAppliedWordSpacing
      );
    }
  }, 300);
}

function startObservingDOM() {
  if (observer) observer.disconnect();
  observer = new MutationObserver(handleMutations);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

// --- Script Execution ---
loadAndApplyInitialStyles();
