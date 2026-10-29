import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { StatusBar } from "expo-status-bar";
import { useState, type ReactNode } from "react";
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { Button } from "./Button.tsx";
import { Text } from "./Text.tsx";

export interface HeroScreenProps {
  readonly title: string;
  readonly subtitle: string;
  /**
   * Pull to refresh on the phones. The web has no gesture for it, so there an "Aktualisieren" pill
   * sits at the hero's top right.
   */
  readonly refresh?: { readonly refreshing: boolean; readonly onRefresh: () => void };
  readonly children: ReactNode;
}

/**
 * A tab's root screen: the green hero with its swoosh, and the cards below it. The hero is content,
 * so it scrolls under the native header and tab bar (design-language.md, section 3, rule 6).
 */
export function HeroScreen({ title, subtitle, refresh, children }: HeroScreenProps) {
  const { color } = Theme.useTheme();
  const insets = useSafeAreaInsets();
  const { overCanvas, onHeroLayout, onScroll } = useHeroCover(insets.top);

  return (
    <View style={[styles.screen, { backgroundColor: color.canvas }]}>
      <StatusBar style={overCanvas ? "auto" : "light"} />
      {/* Overscroll above the hero shows the hero's green, as it did in the legacy app. */}
      <View style={[styles.overscroll, { backgroundColor: color.hero }]} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.grow}
        contentInsetAdjustmentBehavior="automatic"
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          refresh === undefined || Platform.OS === "web" ? undefined : (
            <RefreshControl
              refreshing={refresh.refreshing}
              onRefresh={refresh.onRefresh}
              tintColor="#FFFFFF"
              colors={[color.accent]}
              progressBackgroundColor={color.surface}
            />
          )
        }
      >
        <View style={[styles.grow, { backgroundColor: color.canvas }]}>
          <View
            style={{ backgroundColor: color.hero, paddingTop: heroTop(insets.top) }}
            onLayout={onHeroLayout}
          >
            <View style={[styles.column, styles.heroText]}>
              {refresh === undefined || Platform.OS !== "web" ? null : (
                <View style={styles.action}>
                  <Button
                    kind="quiet"
                    label="Aktualisieren"
                    busy={refresh.refreshing}
                    onPress={refresh.onRefresh}
                  />
                </View>
              )}
              <Text variant="display" accessibilityRole="header" style={styles.onHero}>
                {title}
              </Text>
              <Text variant="title3" style={styles.onHero}>
                {subtitle}
              </Text>
            </View>
          </View>
          <Swoosh fill={color.hero} edge={color.heroEdge} />
          <View style={[styles.column, styles.content]}>{children}</View>
        </View>
      </ScrollView>
      {overCanvas && Platform.OS !== "web" ? (
        <View style={[styles.statusStrip, { height: insets.top, backgroundColor: color.canvas }]} />
      ) : null}
    </View>
  );
}

/**
 * Whether the hero has scrolled out from under the status bar, which is `statusBar` points tall.
 * Pass `onHeroLayout` to the hero and `onScroll` to the scroll view. Once `overCanvas` is true, a
 * strip of canvas keeps the status bar readable and Android's status bar text turns dark. iOS 27
 * runs on UIScene, where React Native can't set that style, so it follows the appearance.
 */
export function useHeroCover(statusBar: number) {
  const [heroBottom, setHeroBottom] = useState(Number.POSITIVE_INFINITY);
  const [overCanvas, setOverCanvas] = useState(false);

  return {
    overCanvas,
    onHeroLayout: (event: LayoutChangeEvent) =>
      setHeroBottom(event.nativeEvent.layout.y + event.nativeEvent.layout.height),
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const covered = event.nativeEvent.contentOffset.y + statusBar > heroBottom;

      if (covered !== overCanvas) setOverCanvas(covered);
    },
  };
}

// iOS insets the scroll view below the status bar itself.
const heroTop = (statusBar: number) =>
  Platform.select({
    ios: Tokens.space.lg,
    android: statusBar + Tokens.space.lg,
    default: Tokens.space.xl,
  });

const band = { width: 390, height: 150, edge: 6 } as const;

// Legacy's BezierClipper (lib/presentation/components/clippers.dart), cut to the curved band below
// the hero: the left edge runs down to the bottom, the right edge stays at the top. The blue line is
// the same curve, `band.edge` lower.
const curve = (offset: number) => {
  const w = band.width;
  const h = band.height - band.edge * 2;

  return [
    `M0 0 L0 ${h + offset}`,
    `C${w * 0.5} ${(h * 5) / 6 + offset} ${w * 0.5} ${h + offset} ${w * 0.7} ${h / 3 + offset}`,
    `C${w * 0.8} ${offset} ${w} ${offset} ${w} ${offset}`,
    `L${w} 0Z`,
  ].join(" ");
};

function Swoosh({ fill, edge }: { readonly fill: string; readonly edge: string }) {
  return (
    <Svg
      width="100%"
      height={band.height}
      viewBox={`0 0 ${band.width} ${band.height}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <Path d={curve(band.edge)} fill={edge} />
      <Path d={curve(0)} fill={fill} />
    </Svg>
  );
}

// The first card starts this far below the hero's text, on top of the band.
const heroGap = 22;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  grow: { flexGrow: 1 },
  overscroll: { position: "absolute", top: 0, left: 0, right: 0, height: "50%" },
  column: {
    width: "100%",
    maxWidth: Tokens.layout.contentMaxWidth,
    alignSelf: "center",
  },
  heroText: { paddingHorizontal: Tokens.layout.cardPadding, gap: Tokens.space.xs },
  action: { alignSelf: "flex-end", marginBottom: Tokens.space.sm },
  onHero: { color: "#FFFFFF" },
  content: {
    marginTop: heroGap - band.height,
    paddingHorizontal: Tokens.layout.gutter,
    paddingBottom: Tokens.space.xxl,
    gap: Tokens.space.lg,
  },
  statusStrip: { position: "absolute", top: 0, left: 0, right: 0, opacity: 0.94 },
});
