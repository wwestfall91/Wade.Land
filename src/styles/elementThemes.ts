export type ElementSpellColor = {
    bg: string;
    border: string;
    text: string;
};

export type StarterButtonTheme = {
    top: string;
    bottom: string;
    border: string;
    text: string;
    glow: string;
};

export const ELEMENT_SPELL_COLORS: Record<string, ElementSpellColor> = {
    fire: { bg: "#ffb680", border: "#d0652c", text: "#2a140a" },
    water: { bg: "#9ad6ff", border: "#3c84c4", text: "#081f33" },
    earth: { bg: "#9fd08a", border: "#4f8a3f", text: "#0f2410" },
    air: { bg: "#dff6ff", border: "#75a4b8", text: "#0f2832" },
    lightning: { bg: "#ffe56d", border: "#b59308", text: "#332700" },
    ice: { bg: "#baf1ff", border: "#5aa8bd", text: "#0f2c34" },
    light: { bg: "#fff3bd", border: "#b59a36", text: "#312700" },
    dark: { bg: "#8d84aa", border: "#514569", text: "#faf9ff" },
    arcane: { bg: "#ffc1e4", border: "#af5f8d", text: "#2f1023" },
};

export const STARTER_BUTTON_THEME_DEFAULT: StarterButtonTheme = {
    top: "#5a71e3",
    bottom: "#2b3ea9",
    border: "#e8edff",
    text: "#fff6a9",
    glow: "rgba(164, 179, 255, 0.32)",
};

export const STARTER_BUTTON_THEME_BY_TYPE: Record<string, StarterButtonTheme> = {
    fire: { top: "#cf5f42", bottom: "#872f20", border: "#ffd1c4", text: "#fff3e8", glow: "rgba(255, 135, 108, 0.34)" },
    water: { top: "#3f7fc6", bottom: "#1f4f89", border: "#b8daff", text: "#ecf7ff", glow: "rgba(114, 191, 255, 0.34)" },
    earth: { top: "#4f8f4a", bottom: "#2f5f2d", border: "#cfeecb", text: "#f3fff1", glow: "rgba(132, 210, 120, 0.32)" },
    air: { top: "#6aa2b8", bottom: "#3d6f84", border: "#d6f2ff", text: "#f3fcff", glow: "rgba(161, 225, 255, 0.34)" },
    lightning: { top: "#b29225", bottom: "#7b620e", border: "#ffe480", text: "#fffbe2", glow: "rgba(255, 224, 120, 0.35)" },
    ice: { top: "#4d9abb", bottom: "#2a647f", border: "#c8f2ff", text: "#eefbff", glow: "rgba(146, 224, 255, 0.34)" },
    light: { top: "#d2b85d", bottom: "#8f7a30", border: "#ffefb4", text: "#fffdf1", glow: "rgba(255, 238, 170, 0.35)" },
    dark: { top: "#69579a", bottom: "#3f2f67", border: "#d6ccff", text: "#f4efff", glow: "rgba(179, 154, 255, 0.32)" },
    arcane: { top: "#b4658f", bottom: "#744165", border: "#ffd2e7", text: "#fff0f8", glow: "rgba(255, 171, 214, 0.34)" },
};