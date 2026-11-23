import { useEffect, useState } from "react";
import { getTheme, subscribeTheme, type ThemeId } from "../core/theme";

/** The look currently applied, kept in step with Settings and the welcome chooser. */
export function useTheme(): ThemeId {
  const [theme, setTheme] = useState<ThemeId>(getTheme);
  useEffect(() => subscribeTheme(() => setTheme(getTheme())), []);
  return theme;
}
