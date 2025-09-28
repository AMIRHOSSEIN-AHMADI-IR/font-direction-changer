// fonts-config.js
if (typeof window !== "undefined") {
  /**
   * @global
   * @type {Array<Object>}
   * An array of font objects used throughout the extension's UI.
   */
  window.FONT_LIST = [
    // The "Default" option
    { value: "", labelKey: "defaultOption", style: "" },

    // --- Persian/Arabic Fonts ---
    { value: "Vazirmatn", labelKey: "vazirmatnFontOption" },
    { value: "Noto Sans Arabic", labelKey: "notoSansArabicFontOption" },
    { value: "Cairo", labelKey: "cairoFontOption" },
    { value: "Rubik", labelKey: "rubikFontOption" },
    { value: "Lalezar", labelKey: "lalezarFontOption" },
    { value: "Baloo Bhaijaan 2", labelKey: "balooBhaijaan2FontOption" },
    { value: "Playpen Sans", labelKey: "playpenSansFontOption" },
    { value: "Gulzar", labelKey: "gulzarFontOption" },

    // --- English/Web Fonts ---
    { value: "Roboto", labelKey: "robotoFontOption" },
    { value: "Open Sans", labelKey: "openSansFontOption" },
    { value: "Inter", labelKey: "interFontOption" },
    { value: "Noto Sans", labelKey: "notoSansFontOption" },
    { value: "Nunito", labelKey: "nunitoFontOption" },
    { value: "Playfair Display", labelKey: "playfairDisplayFontOption" },
    { value: "Roboto Slab", labelKey: "robotoSlabFontOption" },
    { value: "Josefin Sans", labelKey: "josefinSansFontOption" },
    { value: "Merriweather", labelKey: "merriweatherFontOption" },
    { value: "Crimson Text", labelKey: "crimsonTextFontOption" },
    { value: "Roboto Mono", labelKey: "robotoMonoFontOption" },
  ];
}
