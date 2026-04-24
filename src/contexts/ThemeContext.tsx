import { createContext, useContext, useEffect, useState } from "react";
import { THEMES, AppTheme, DEFAULT_THEME_ID, getTheme } from "@/lib/themes";

const THEME_KEY   = "swiftdata-theme";
const DARK_KEY    = "swiftdata-dark";

interface ThemeContextValue {
  theme: AppTheme;
  setThemeId: (id: string) => void;
  isDark: boolean;
  toggleDark: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: THEMES[0],
  setThemeId: () => {},
  isDark: true,
  toggleDark: () => {},
});

export const useAppTheme = () => useContext(ThemeContext);

function applyTheme(theme: AppTheme, isDark: boolean) {
  const root = document.documentElement;

  // ── Accent color ───────────────────────────────────────────────────────────
  root.style.setProperty("--primary",            theme.primary);
  root.style.setProperty("--ring",               theme.primary);
  root.style.setProperty("--accent",             theme.primary);
  // Primary foreground: dark text for light-accent themes (amber), white for vivid-color themes
  root.style.setProperty("--primary-foreground", theme.isLight ? "0 0% 5%" : "0 0% 100%");
  root.style.setProperty("--sidebar-primary",    theme.primary);

  // ── Dark / Light base vars ─────────────────────────────────────────────────
  root.classList.toggle("dark", isDark);

  if (isDark) {
    root.style.setProperty("--background",            "240 15% 4%");
    root.style.setProperty("--foreground",            "0 0% 95%");
    root.style.setProperty("--card",                  "240 12% 8%");
    root.style.setProperty("--card-foreground",       "0 0% 95%");
    root.style.setProperty("--popover",               "240 12% 8%");
    root.style.setProperty("--popover-foreground",    "0 0% 95%");
    root.style.setProperty("--secondary",             "240 10% 13%");
    root.style.setProperty("--secondary-foreground",  "0 0% 90%");
    root.style.setProperty("--muted",                 "240 10% 12%");
    root.style.setProperty("--muted-foreground",      "240 5% 60%");
    root.style.setProperty("--border",                "240 10% 18%");
    root.style.setProperty("--input",                 "240 10% 18%");
    root.style.setProperty("--glass-rgb",             theme.glassRgb || "10,10,18");
    root.style.setProperty("--glass-border-rgb",      theme.glassBorder || "255,255,255");
    root.setAttribute("data-glass", "1");
    if (theme.bodyGradient && theme.bodyGradient !== "none") {
      document.body.style.backgroundImage    = theme.bodyGradient;
      document.body.style.backgroundAttachment = "fixed";
    } else {
      document.body.style.backgroundImage    = "";
      document.body.style.backgroundAttachment = "";
    }
  } else {
    root.style.setProperty("--background",            "0 0% 100%");
    root.style.setProperty("--foreground",            "0 0% 8%");
    root.style.setProperty("--card",                  "0 0% 100%");
    root.style.setProperty("--card-foreground",       "0 0% 8%");
    root.style.setProperty("--popover",               "0 0% 100%");
    root.style.setProperty("--popover-foreground",    "0 0% 8%");
    root.style.setProperty("--secondary",             "40 20% 94%");
    root.style.setProperty("--secondary-foreground",  "0 0% 8%");
    root.style.setProperty("--muted",                 "40 15% 93%");
    root.style.setProperty("--muted-foreground",      "0 0% 42%");
    root.style.setProperty("--border",                "40 15% 85%");
    root.style.setProperty("--input",                 "40 15% 85%");
    root.style.setProperty("--glass-rgb",             "255,255,255");
    root.style.setProperty("--glass-border-rgb",      "200,200,200");
    root.setAttribute("data-glass", "0");
    document.body.style.backgroundImage    = "";
    document.body.style.backgroundAttachment = "";
  }

  root.style.setProperty("--hero-hex", theme.heroHex);
  root.setAttribute("data-theme", theme.id);
  document.body.style.minHeight = "100vh";
}

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [themeId, setThemeIdState] = useState<string>(() => {
    try { return localStorage.getItem(THEME_KEY) ?? DEFAULT_THEME_ID; }
    catch { return DEFAULT_THEME_ID; }
  });

  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(DARK_KEY);
      if (stored !== null) return stored === "true";
      return true; // default: dark
    } catch {
      return true;
    }
  });

  const theme = getTheme(themeId);

  useEffect(() => {
    applyTheme(theme, isDark);
  }, [theme, isDark]);

  const setThemeId = (id: string) => {
    setThemeIdState(id);
    try { localStorage.setItem(THEME_KEY, id); } catch {}
  };

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    try { localStorage.setItem(DARK_KEY, String(next)); } catch {}
  };

  return (
    <ThemeContext.Provider value={{ theme, setThemeId, isDark, toggleDark }}>
      {children}
    </ThemeContext.Provider>
  );
};
