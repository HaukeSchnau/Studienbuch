import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from "expo-router/ui";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { Text } from "@stu/ui/Text";

// The web has no system tab bar, so it gets ours, from the same tokens: a bottom bar with Android's
// pill indicator on phones, a side rail from the wide breakpoint on (design-language.md, section 3).

export function AppTabs() {
  const { color } = Theme.useTheme();
  const insets = useSafeAreaInsets();
  const wide = useWindowDimensions().width >= Tokens.layout.wideBreakpoint;

  const list = (
    <TabList
      style={[
        wide ? styles.rail : styles.bar,
        {
          backgroundColor: color.surface,
          borderColor: color.hairline,
          paddingBottom: wide ? 0 : insets.bottom,
        },
      ]}
    >
      <TabTrigger name="(uebersicht)" href="/" asChild>
        <TabItem label="Übersicht" />
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
  isFocused = false,
  ...props
}: Omit<TabTriggerSlotProps, "ref"> & { readonly label: string }) {
  const { color } = Theme.useTheme();
  const tint = isFocused ? color.accent : color.inkSoft;

  return (
    <Pressable {...props} accessibilityRole="tab" style={styles.item}>
      <View
        style={[
          styles.indicator,
          { backgroundColor: isFocused ? color.accentTint : "transparent" },
        ]}
      >
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Path
            d="M4 10.4 12 4l8 6.4V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z"
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
    alignItems: "center",
    borderRightWidth: 1,
    paddingTop: Tokens.space.xl,
  },
  item: {
    minWidth: 96,
    minHeight: Tokens.layout.minTarget,
    alignItems: "center",
    gap: Tokens.space.xs,
    paddingBottom: Tokens.space.sm,
    cursor: "pointer",
  },
  indicator: {
    width: 64,
    height: 32,
    borderRadius: Tokens.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
