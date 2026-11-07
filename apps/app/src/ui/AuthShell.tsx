import { Arrive } from "@stu/ui/Arrive";
import { AuthBackdrop } from "@stu/ui/AuthBackdrop";
import { AuthCard } from "@stu/ui/AuthCard";
import { Icon } from "@stu/ui/Icon";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import * as Option from "effect/Option";
import { useCanGoBack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import { Image, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import appIcon from "../../assets/icon.png";
import { ServerOrigin } from "../infra/api/ServerOrigin.ts";

export interface AuthShellProps {
  readonly children: ReactNode;
}

/**
 * The frame of every step before the app proper, ported from the old web's AuthShell: the pastel
 * backdrop, the logo, one card that grows and shrinks with its content, and the legal links below.
 * On iOS a round button leads back, as in the legacy app; Android has its system back and the
 * browser its history.
 */
export function AuthShell({ children }: AuthShellProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // The layout stays mounted while its steps change, so it must follow the stack.
  const canGoBack = useCanGoBack();

  return (
    <AuthBackdrop>
      <StatusBar style="auto" />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          // iOS insets the scroll view by the safe area itself.
          Platform.OS === "ios"
            ? null
            : { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 48 },
        ]}
        contentInsetAdjustmentBehavior="automatic"
        // Forms stay reachable above the keyboard, and a tap on a button doesn't only close it.
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.column}>
          <Arrive style={styles.wordmark}>
            <Wordmark />
          </Arrive>
          <AuthCard>{children}</AuthCard>
          <Arrive delay={220}>
            <Legal />
          </Arrive>
        </View>
      </ScrollView>
      {Platform.OS === "ios" && canGoBack ? (
        <BackButton top={insets.top + Tokens.space.lg} onPress={() => router.back()} />
      ) : null}
    </AuthBackdrop>
  );
}

/** The app's icon and name above the card, as the old web's Wordmark. */
function Wordmark() {
  const { color, elevation } = Theme.useTheme();

  return (
    <View style={styles.wordmarkRow}>
      <Image
        source={appIcon}
        accessibilityIgnoresInvertColors
        style={[styles.icon, { boxShadow: elevation.card }]}
      />
      <Text variant="headline" weight="bold" style={[styles.name, { color: color.accent }]}>
        Studienbuch
      </Text>
    </View>
  );
}

const legalPages = [
  { label: "Impressum", path: "/impressum" },
  { label: "Datenschutz", path: "/datenschutz" },
] as const;

/**
 * Impressum and Datenschutz from the landing page. The browser opens them in a new tab, so a
 * half-typed form stays where it was; the phones open them in the browser.
 */
function Legal() {
  const { color } = Theme.useTheme();

  return Option.match(ServerOrigin.origin, {
    onNone: () => null,
    onSome: (origin) => (
      <View style={styles.legal}>
        {legalPages.map((page) => (
          <Pressable
            key={page.path}
            accessibilityRole="link"
            href={Platform.OS === "web" ? page.path : undefined}
            hrefAttrs={{ target: "_blank", rel: "noopener" }}
            onPress={
              Platform.OS === "web"
                ? undefined
                : () => void Linking.openURL(new URL(page.path, origin).href)
            }
            style={({ pressed }) => [styles.legalLink, pressed ? styles.pressed : null]}
          >
            <Text variant="subhead" style={[styles.legalText, { color: color.inkSoft }]}>
              {page.label}
            </Text>
          </Pressable>
        ))}
      </View>
    ),
  });
}

/** The legacy app's round button back to the previous step. */
function BackButton({ top, onPress }: { readonly top: number; readonly onPress: () => void }) {
  const { color, elevation } = Theme.useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Zurück"
      onPress={onPress}
      style={({ pressed }) => [
        styles.back,
        { top, backgroundColor: color.surface, boxShadow: elevation.float },
        pressed ? styles.pressed : null,
      ]}
    >
      <Icon name="back" color={color.ink} size={24} />
    </Pressable>
  );
}

declare module "react-native" {
  interface PressableProps {
    /** react-native-web's attributes for a pressable rendered as an anchor. Native ignores them. */
    readonly hrefAttrs?: { readonly target?: string; readonly rel?: string } | undefined;
  }
}

const styles = StyleSheet.create({
  // The old web's main: centred, px-5.
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 20, paddingVertical: 48 },
  // max-w-md
  column: { width: "100%", maxWidth: 448, alignSelf: "center" },
  wordmark: { alignItems: "center", marginBottom: 28 },
  wordmarkRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { width: 32, height: 32, borderRadius: 8 },
  // text-lg
  name: { fontSize: 18, lineHeight: 28 },
  // mt-6 to the text, less what the touch target adds above it.
  legal: { flexDirection: "row", justifyContent: "center", gap: 20, marginTop: 10 },
  legalLink: { minHeight: Tokens.layout.minTarget, justifyContent: "center", cursor: "pointer" },
  // text-sm
  legalText: { fontSize: 14, lineHeight: 20, fontWeight: "400" },
  back: {
    position: "absolute",
    left: Tokens.space.lg,
    width: 44,
    height: 44,
    borderRadius: Tokens.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.6 },
});
