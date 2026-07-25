import { useEffect } from "react";
import { useTheme } from "next-themes";

const THEME_COLOR_LIGHT = "#f9fafb";
const THEME_COLOR_DARK = "#101318";

export function useThemeColorSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute("content", resolvedTheme === "dark" ? THEME_COLOR_DARK : THEME_COLOR_LIGHT);
  }, [resolvedTheme]);
}
