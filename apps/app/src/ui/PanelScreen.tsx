import { Icon, type IconName } from "@stu/ui/Icon";
import { PanelWave } from "@stu/ui/PanelWave";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useHeroCover } from "./HeroScreen.tsx";

export interface PanelScreenProps {
  readonly title: string;
  /** The arrow before the title. */
  readonly onBack: () => void;
  /** A white glyph at the title's right, such as "+" for a new homework. */
  readonly action?: {
    readonly label: string;
    readonly icon: IconName;
    readonly onPress: () => void;
  };
  /** Under the title, such as the sync status. */
  readonly status?: ReactNode;
  /** On the white sheet. */
  readonly children?: ReactNode;
}

/**
 * Homework's own pages as the Flutter app drew them: a short blue header with legacy's darker wave,
 * the way back and the title in white, and a white sheet with round top corners over its bottom.
 * The header draws its own arrow on every platform, as Flutter did; the phones' back gestures work
 * as everywhere else.
 */
export function PanelScreen({ title, onBack, action, status, children }: PanelScreenProps) {
  const { color } = Theme.useTheme();
  const insets = useSafeAreaInsets();
  const { overCanvas, onHeroEnd, onScroll } = useHeroCover(insets.top);

  return (
    <View style={[styles.screen, { backgroundColor: color.surface }]}>
      <StatusBar style={overCanvas ? "auto" : "light"} />
      {/* Overscroll above the header shows its blue. */}
      <View style={[styles.overscroll, { backgroundColor: color.panel }]} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.grow}
        // The header pads below the status bar itself.
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <View
          style={[styles.header, { backgroundColor: color.panel, paddingTop: top(insets.top) }]}
          onLayout={(event) => {
            const { y, height } = event.nativeEvent.layout;

            onHeroEnd(y + height - Tokens.radius.panel);
          }}
        >
          <PanelWave color={color.panelFold} />
          <View style={[styles.column, styles.row]}>
            <Glyph label="Zurück" icon="arrowBack" onPress={onBack} />
            <Text variant="title2" accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            {action === undefined ? null : (
              <Glyph label={action.label} icon={action.icon} onPress={action.onPress} />
            )}
          </View>
          {status === undefined ? null : (
            <View style={[styles.column, styles.status]}>{status}</View>
          )}
        </View>
        <View style={[styles.sheet, { backgroundColor: color.surface }]}>
          <View style={styles.column}>{children}</View>
        </View>
      </ScrollView>
      {overCanvas && Platform.OS !== "web" ? (
        <View
          style={[styles.statusStrip, { height: insets.top, backgroundColor: color.surface }]}
        />
      ) : null}
    </View>
  );
}

function Glyph({
  label,
  icon,
  onPress,
}: {
  readonly label: string;
  readonly icon: IconName;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.glyph, pressed ? styles.pressed : null]}
    >
      <Icon name={icon} color={onPanel} size={28} />
    </Pressable>
  );
}

// The panel is blue in both schemes, so its text is white.
const onPanel = "#FFFFFF";

const top = (statusBar: number) => statusBar + Tokens.space.sm;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  grow: { flexGrow: 1 },
  overscroll: { position: "absolute", top: 0, left: 0, right: 0, height: "50%" },
  header: { paddingBottom: Tokens.radius.panel + Tokens.space.lg, overflow: "hidden" },
  column: { width: "100%", maxWidth: Tokens.layout.contentMaxWidth, alignSelf: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Tokens.space.xs,
    paddingHorizontal: Tokens.layout.gutter - Tokens.space.xs,
  },
  title: { flex: 1, color: onPanel },
  status: { paddingHorizontal: Tokens.layout.cardPadding, paddingTop: Tokens.space.xs },
  glyph: {
    width: Tokens.layout.minTarget,
    height: Tokens.layout.minTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Tokens.radius.pill,
    cursor: "pointer",
  },
  pressed: { opacity: 0.6 },
  sheet: {
    flexGrow: 1,
    marginTop: -Tokens.radius.panel,
    borderTopLeftRadius: Tokens.radius.panel,
    borderTopRightRadius: Tokens.radius.panel,
    paddingTop: Tokens.space.xl,
    paddingBottom: Tokens.space.xxxl,
    paddingHorizontal: Tokens.layout.cardPadding + Tokens.space.xs,
  },
  statusStrip: { position: "absolute", top: 0, left: 0, right: 0, opacity: 0.94 },
});
