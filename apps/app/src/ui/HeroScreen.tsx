import { Hero } from "@stu/ui/Hero";
import { Icon } from "@stu/ui/Icon";
import { Pill } from "@stu/ui/Pill";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { type Href, Stack, useNavigation, useRoute, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState, type ReactNode } from "react";
import {
  Platform,
  Pressable,
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
  /** Draws the hand-drawn line under the title, as under "Moin, Lena!". */
  readonly underline?: boolean;
  readonly subtitle?: string | undefined;
  /** Short facts in white pills under the subtitle, such as "KW 47". */
  readonly chips?: ReadonlyArray<string>;
  /** Buttons at the right of the toolbar row above the title, such as the week arrows. */
  readonly actions?: ReactNode;
  /** The content column's widest, wider than the usual for the week's grid. */
  readonly maxWidth?: number;
  /** Under the subtitle, such as the sync status. */
  readonly status?: ReactNode;
  /** Art at the right of the title, such as the app icon on the sign-in screens. */
  readonly aside?: ReactNode;
  /** Art at the left of the title, such as the student's initials on Profil. */
  readonly leading?: ReactNode;
  /**
   * Pull to refresh on the phones. The web has none and no button for it either, because the sync
   * engine pulls on its own.
   */
  readonly refresh?: { readonly refreshing: boolean; readonly onRefresh: () => void };
  /**
   * A part as wide as the screen under the cards, such as the homework panel. It runs to the
   * screen's bottom, and the bottom's overscroll takes its colour.
   */
  readonly footer?: { readonly color: string; readonly children: ReactNode };
  /**
   * A screen above the tabs gets "Zurück" in the hero's toolbar row on the web and Android, and
   * iOS its native header. Without a screen before it, as after a reload or a deep link, back
   * leads here.
   */
  readonly back?: Href;
  readonly children?: ReactNode;
}

/**
 * A tab's root screen: the hero and the cards on its band. The hero is content, so it scrolls under
 * the native header and tab bar (design-language.md, section 3, rule 6).
 */
export function HeroScreen({
  title,
  underline,
  subtitle,
  chips,
  actions,
  maxWidth,
  status,
  aside,
  leading,
  refresh,
  footer,
  back,
  children,
}: HeroScreenProps) {
  const { color } = Theme.useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { overCanvas, onHeroEnd, onScroll } = useHeroCover(insets.top);

  const firstInStack = navigation.getState()?.routes[0]?.key === route.key;

  const goBack = (fallback: Href) => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  };

  return (
    <View style={[styles.screen, { backgroundColor: color.canvas }]}>
      {/* iOS's header has a back button only above another screen of the same stack, so the
          first screen of a group, as Notizbuch-Schlüssel above the tabs, brings its own. */}
      {back !== undefined && Platform.OS === "ios" && firstInStack ? (
        <Stack.Screen
          options={{
            headerLeft: () => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Zurück"
                hitSlop={12}
                onPress={() => goBack(back)}
              >
                <Icon name="back" color="#FFFFFF" size={28} />
              </Pressable>
            ),
          }}
        />
      ) : null}
      <StatusBar style={overCanvas ? "auto" : "light"} />
      {/* Overscroll above the hero shows the hero's green, as it did in the legacy app. */}
      <View style={[styles.overscroll, { backgroundColor: color.hero }]} />
      {footer === undefined ? null : (
        <View style={[styles.underscroll, { backgroundColor: footer.color }]} />
      )}
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
          underline={underline}
          subtitle={subtitle}
          chips={chips}
          status={status}
          aside={aside}
          leading={leading}
          toolbar={
            (back === undefined || Platform.OS === "ios") && actions === undefined
              ? undefined
              : {
                  start:
                    back === undefined || Platform.OS === "ios" ? undefined : (
                      <Pill icon="back" label="Zurück" onPress={() => goBack(back)} />
                    ),
                  end: actions,
                }
          }
          top={heroTop(insets.top)}
          maxWidth={maxWidth}
          onColourEnd={onHeroEnd}
        >
          {children}
        </Hero>
        {footer === undefined ? (
          <View style={styles.end} />
        ) : (
          <View style={[styles.footer, { backgroundColor: color.canvas }]}>{footer.children}</View>
        )}
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
  underscroll: { position: "absolute", bottom: 0, left: 0, right: 0, height: "50%" },
  footer: { flexGrow: 1, marginTop: Tokens.space.lg },
  end: { height: Tokens.space.xxl },
  statusStrip: { position: "absolute", top: 0, left: 0, right: 0, opacity: 0.94 },
});
