import { Tokens } from "@stu/ui/Tokens";
import { NativeTabs } from "expo-router/native-tabs";
import { Platform, useColorScheme } from "react-native";

/**
 * The system tab bar: Liquid Glass on iOS, a Material navigation bar on Android. Brand colour marks
 * the selected tab only; on Android our static scheme replaces Material You (D48).
 */
export function AppTabs() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const chrome = Tokens.androidChrome[scheme];

  return (
    <NativeTabs
      minimizeBehavior="automatic"
      {...Platform.select({
        ios: { tintColor: Tokens.color[scheme].accent },
        default: {
          backgroundColor: chrome.container,
          indicatorColor: chrome.indicator,
          rippleColor: chrome.ripple,
          iconColor: { default: Tokens.color[scheme].inkSoft, selected: chrome.onIndicator },
          labelStyle: {
            default: { color: Tokens.color[scheme].inkSoft },
            selected: { color: chrome.onIndicator },
          },
        },
      })}
    >
      <NativeTabs.Trigger name="(uebersicht)">
        <NativeTabs.Trigger.Icon
          sf={{ default: "house", selected: "house.fill" }}
          md={{ default: "home", selected: "home_filled" }}
        />
        <NativeTabs.Trigger.Label>Übersicht</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
