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
  /** Draws the pen's underline under the title, as under "Moin, Lena!". */
  readonly underline?: boolean;
  readonly subtitle: string;
  /** Under the subtitle, such as the chip that says the device is offline. */
  readonly status?: ReactNode;
  /** Art at the right of the title, such as the app icon on the sign-in screens. */
  readonly aside?: ReactNode;
  /**
   * Pull to refresh on the phones. The web has none and no button for it either, because the sync
   * engine pulls on its own.
   */
  readonly refresh?: { readonly refreshing: boolean; readonly onRefresh: () => void };
  /**
   * What ends the screen from edge to edge, such as the homework panel, and its colour, which
   * shows below it where the list bounces and where the tab bar floats over the screen's end.
   */
  readonly footer?: { readonly color: string; readonly content: ReactNode };
  readonly children: ReactNode;
}

/**
 * A tab's root screen on the app's pale green: the hero, the cards on its band and what ends the
 * screen. The hero is content, so it scrolls under the native header and tab bar
 * (design-language.md, section 3, rule 6).
 */
export function HeroScreen({
  title,
  underline,
  subtitle,
  status,
  aside,
  refresh,
  footer,
  children,
}: HeroScreenProps) {
  const { color } = Theme.useTheme();
  const insets = useSafeAreaInsets();
  const { overCanvas, onHeroEnd, onScroll } = useHeroCover(insets.top);

  return (
    <View style={[styles.screen, { backgroundColor: color.appCanvas }]}>
      <StatusBar style={overCanvas ? "auto" : "light"} />
      {/* Overscroll above the hero shows the hero's green, as it did in the legacy app. */}
      <View style={[styles.overscroll, { backgroundColor: color.hero }]} />
      {footer === undefined ? null : (
        <View style={[styles.underscroll, { backgroundColor: footer.color }]} />
      )}
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.grow, { backgroundColor: color.appCanvas }]}
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
          underline={underline}
          subtitle={subtitle}
          status={status}
          aside={aside}
          top={heroTop(insets.top)}
          onColourEnd={onHeroEnd}
          canvas={color.appCanvas}
        >
          {children}
        </Hero>
        {footer === undefined ? (
          <View style={styles.end} />
        ) : (
          <View style={styles.footer}>{footer.content}</View>
        )}
      </ScrollView>
      {overCanvas && Platform.OS !== "web" ? (
        <View
          style={[styles.statusStrip, { height: insets.top, backgroundColor: color.appCanvas }]}
        />
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
  underscroll: { position: "absolute", bottom: 0, left: 0, right: 0, height: "50%" },
  end: { height: Tokens.space.xxl },
  // It takes the height the cards leave, so its colour reaches the screen's end on a tall screen.
  footer: { flexGrow: 1, marginTop: Tokens.space.xl },
  statusStrip: { position: "absolute", top: 0, left: 0, right: 0, opacity: 0.94 },
});
