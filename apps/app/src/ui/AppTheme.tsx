import { Theme } from "@stu/ui/Theme";
import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import type { ReactNode } from "react";
import { Platform, useColorScheme } from "react-native";

import { WebStyles } from "./WebStyles.tsx";

/**
 * The tokens for React Navigation, whose screens otherwise flash white between tabs. Native chrome
 * keeps the system font; on the web, where the chrome is ours, it is Nunito.
 */
export function AppTheme({ children }: { readonly children: ReactNode }) {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const { color } = Theme.useTheme();
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;

  const fonts =
    Platform.OS === "web"
      ? {
          regular: { fontFamily: Theme.fontFamily, fontWeight: "500" as const },
          medium: { fontFamily: Theme.fontFamily, fontWeight: "600" as const },
          bold: { fontFamily: Theme.fontFamily, fontWeight: "800" as const },
          heavy: { fontFamily: Theme.fontFamily, fontWeight: "800" as const },
        }
      : base.fonts;

  return (
    <ThemeProvider
      value={{
        dark: scheme === "dark",
        fonts,
        colors: {
          primary: color.accent,
          background: color.canvas,
          card: color.canvas,
          text: color.ink,
          border: color.hairline,
          notification: color.danger,
        },
      }}
    >
      <WebStyles />
      {children}
    </ThemeProvider>
  );
}
