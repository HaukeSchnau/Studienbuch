import { StyleSheet } from "react-native";

// react-native-web adds `getSheet` to StyleSheet; React Native's types don't know it.
interface WebStyleSheet {
  getSheet(): { id: string; textContent: string };
}

const isWebStyleSheet = (sheet: typeof StyleSheet): sheet is typeof StyleSheet & WebStyleSheet =>
  "getSheet" in sheet;

/**
 * Writes the atomic CSS react-native-web collected during server rendering, under the id RNW looks
 * for in the browser, so shared components arrive styled before any script runs. Render it in `<head>`.
 */
export function ReactNativeWebStyles() {
  if (!isWebStyleSheet(StyleSheet)) return null;
  const sheet = StyleSheet.getSheet();

  return (
    <style
      id={sheet.id}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: sheet.textContent }}
    />
  );
}
