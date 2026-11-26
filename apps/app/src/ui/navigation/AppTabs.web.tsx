import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from "expo-router/ui";
import { Image, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { Text } from "@stu/ui/Text";

import appIcon from "../../../assets/icon.png";

// The web has no system tab bar, so it gets ours, from the same tokens: a bottom bar with Android's
// pill indicator on phones, a side rail with the app icon from the wide breakpoint on
// (design-language.md, section 3).

// Each tab's glyph on a 24-point grid, outlined and filled when selected, as the phones' symbols are.
const glyphs = {
  house: "M4 10.4 12 4l8 6.4V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z",
  calendar:
    "M5 5.5h14a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1zM4 10h16M8.5 3.5v4M15.5 3.5v4",
  person: "M12 3.5a4 4 0 1 1 0 8a4 4 0 0 1 0-8zM4.5 20c.8-3.8 3.7-6.5 7.5-6.5s6.7 2.7 7.5 6.5z",
};

export function AppTabs() {
  const { color, elevation } = Theme.useTheme();
  const insets = useSafeAreaInsets();
  const wide = useWindowDimensions().width >= Tokens.layout.wideBreakpoint;

  const list = (
    <TabList
      role="tablist"
      style={[
        wide ? styles.rail : styles.bar,
        {
          backgroundColor: color.surface,
          borderColor: color.hairline,
          paddingBottom: wide ? 0 : insets.bottom,
        },
      ]}
    >
      {wide ? (
        <Image
          source={appIcon}
          accessibilityLabel="Studienbuch"
          style={[styles.icon, { boxShadow: elevation.card }]}
        />
      ) : null}
      <TabTrigger name="(uebersicht)" href="/" asChild>
        <TabItem label="Übersicht" glyph={glyphs.house} wide={wide} />
      </TabTrigger>
      <TabTrigger name="(woche)" href="/woche" asChild>
        <TabItem label="Meine Woche" glyph={glyphs.calendar} wide={wide} />
      </TabTrigger>
      <TabTrigger name="(profil)" href="/profil" asChild>
        <TabItem label="Profil" glyph={glyphs.person} wide={wide} />
      </TabTrigger>
    </TabList>
  );

  return (
    <Tabs style={[styles.tabs, { flexDirection: wide ? "row" : "column" }]}>
      {wide ? list : null}
      <TabSlot />
      {wide ? null : list}
    </Tabs>
  );
}

function TabItem({
  label,
  glyph,
  wide,
  isFocused = false,
  ...props
}: Omit<TabTriggerSlotProps, "ref"> & {
  readonly label: string;
  readonly glyph: string;
  readonly wide: boolean;
}) {
  const { color } = Theme.useTheme();
  const tint = isFocused ? color.accent : color.inkSoft;

  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      aria-selected={isFocused}
      style={[styles.item, wide ? null : styles.barItem]}
    >
      <View
        style={[
          styles.indicator,
          { backgroundColor: isFocused ? color.accentTint : "transparent" },
        ]}
      >
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Path
            d={glyph}
            fill={isFocused ? tint : "none"}
            stroke={tint}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <Text variant="footnote" style={{ color: tint }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabs: { flex: 1 },
  bar: {
    flexDirection: "row",
    justifyContent: "center",
    borderTopWidth: 1,
    paddingTop: Tokens.space.sm,
  },
  rail: {
    width: 96,
    flexDirection: "column",
    // TabList spreads its items by default.
    justifyContent: "flex-start",
    alignItems: "center",
    gap: Tokens.space.md,
    borderRightWidth: 1,
    paddingTop: Tokens.space.xl,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: Tokens.radius.cell + 2,
    marginBottom: Tokens.space.md,
  },
  item: {
    minWidth: 96,
    minHeight: Tokens.layout.minTarget,
    alignItems: "center",
    gap: Tokens.space.xs,
    paddingBottom: Tokens.space.sm,
    cursor: "pointer",
  },
  // The phone bar shares its width between the tabs, as Android's navigation bar does.
  barItem: { flex: 1, maxWidth: 168 },
  indicator: {
    width: 64,
    height: 32,
    borderRadius: Tokens.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
