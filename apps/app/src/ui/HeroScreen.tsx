import { Hero } from "@stu/ui/Hero";
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
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface HeroScreenProps {
  readonly title: string;
  readonly subtitle: string;
  /** Art at the right of the title, such as the app icon on the sign-in screens. */
  readonly aside?: ReactNode;
  /**
   * Pull to refresh on the phones. The web has none and no button for it either, because the sync
   * engine pulls on its own.
   */
  readonly refresh?: { readonly refreshing: boolean; readonly onRefresh: () => void };
  readonly children: ReactNode;
}

/**
 * A tab's root screen: the hero and the cards on its band. The hero is content, so it scrolls under
 * the native header and tab bar (design-language.md, section 3, rule 6).
 */
export function HeroScreen({ title, subtitle, aside, refresh, children }: HeroScreenProps) {
  const { color } = Theme.useTheme();
  const insets = useSafeAreaInsets();
  const { overCanvas, onHeroEnd, onScroll } = useHeroCover(insets.top);

  return (
    <View style={[styles.screen, { backgroundColor: color.canvas }]}>
      <StatusBar style={overCanvas ? "auto" : "light"} />
      {/* Overscroll above the hero shows the hero's green, as it did in the legacy app. */}
      <View style={[styles.overscroll, { backgroundColor: color.hero }]} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.grow, { backgroundColor: color.canvas }]}
        contentInsetAdjustmentBehavior="automatic"
        // Forms stay reachable above the keyboard, and a tap on a button doesn't only close it.
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
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
        <Hero
          title={title}
          subtitle={subtitle}
          aside={aside}
          top={heroTop(insets.top)}
          onColourEnd={onHeroEnd}
        >
          {children}
        </Hero>
        <View style={styles.end} />
      </ScrollView>
      {overCanvas && Platform.OS !== "web" ? (
        <View style={[styles.statusStrip, { height: insets.top, backgroundColor: color.canvas }]} />
      ) : null}
    </View>
  );
}

/**
 * Whether the hero's colour has scrolled out from under the status bar, which is `statusBar` points
 * tall. Pass `onHeroEnd` to the hero's `onColourEnd` and `onScroll` to the scroll view. Then a strip
 * of canvas keeps the status bar readable and Android's status bar text turns dark. iOS 27 runs on
 * UIScene, where React Native can't set that style, so it follows the appearance.
 */
export function useHeroCover(statusBar: number) {
  const [heroBottom, setHeroBottom] = useState(Number.POSITIVE_INFINITY);
  const [overCanvas, setOverCanvas] = useState(false);

  return {
    overCanvas,
    onHeroEnd: (y: number) => setHeroBottom(y),
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

const styles = StyleSheet.create({
  screen: { flex: 1 },
  grow: { flexGrow: 1 },
  overscroll: { position: "absolute", top: 0, left: 0, right: 0, height: "50%" },
  end: { height: Tokens.space.xxl },
  statusStrip: { position: "absolute", top: 0, left: 0, right: 0, opacity: 0.94 },
});
