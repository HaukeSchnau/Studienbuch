import { Button } from "@stu/ui/Button";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { TickedBox } from "@stu/ui/TickBox";
import { Tokens } from "@stu/ui/Tokens";
import { Vector } from "@stu/ui/Vector";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { HomeworkCard } from "./HomeworkCard.tsx";
import type { HomeworkItem } from "./HomeworkItem.ts";

export interface HomeworkPanelProps {
  /** The homework to show, `undefined` while the device still reads it. */
  readonly items: ReadonlyArray<HomeworkItem.Item> | undefined;
  /** Set while this device has no key to the notebook. The panel offers to unlock instead. */
  readonly locked?: { readonly onUnlock: () => void } | undefined;
  /** Ticks a homework done, or opens it again. */
  readonly onToggle: (id: string, done: boolean) => void;
  /** "scroll" moves the cards sideways, on the phones; "wrap" sets them in rows, on the wide web. */
  readonly layout: "scroll" | "wrap";
  /** The app runs the panel to the screen's bottom. */
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * The Flutter app's blue "Hausaufgaben" panel with its darker wave, and a navy card per homework
 * (D67). On the phones up to three cards make one row, and from four on two rows scroll sideways, as
 * Flutter's grid did. The wide web sets them in rows of three.
 */
export function HomeworkPanel({ items, locked, onToggle, layout, style }: HomeworkPanelProps) {
  const { color } = Theme.useTheme();

  return (
    <View style={[styles.panel, { backgroundColor: color.panel }, style]}>
      {/* A box of its own: the phones size an absolute child's 100 % without the padding. */}
      <View style={StyleSheet.absoluteFill}>
        <Vector
          width="100%"
          height="100%"
          viewBox="0 0 390 330"
          stretch
          paths={[{ d: wave, fill: color.panelFold }]}
        />
      </View>
      <View style={styles.column}>
        <Text variant="title1" accessibilityRole="header" aria-level={2} style={styles.title}>
          Hausaufgaben
        </Text>
        {locked !== undefined ? (
          <Notice
            title="Dein Notizbuch ist gesperrt"
            text="Deine Hausaufgaben sind verschlüsselt. Entsperr dein Notizbuch, dann stehen sie hier."
            action={{ label: "Entsperren", onPress: locked.onUnlock }}
          />
        ) : items === undefined ? null : items.length === 0 ? (
          <Notice
            title="Keine Hausaufgaben offen"
            text="Genieß die freie Zeit!"
            picture={<TickedBox color={onPanel} size={44} />}
          />
        ) : layout === "wrap" ? (
          <View style={styles.wrap}>
            {items.map((item) => (
              <HomeworkCard key={item.id} item={item} onToggle={onToggle} style={styles.wide} />
            ))}
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.grid}
          >
            {rows(items).map((row) => (
              <View key={row.key} style={styles.row}>
                {row.items.map((item) => (
                  <HomeworkCard key={item.id} item={item} onToggle={onToggle} />
                ))}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

/** Flutter's grid: one row up to three cards, else two, filled column by column. */
const rows = (items: ReadonlyArray<HomeworkItem.Item>) =>
  items.length < 4
    ? [{ key: "top", items }]
    : [
        { key: "top", items: items.filter((_, index) => index % 2 === 0) },
        { key: "bottom", items: items.filter((_, index) => index % 2 === 1) },
      ];

// Legacy's AufgabenClipper on a 390 by 330 panel: down from the left edge, then up to the right.
const wave =
  "M0 198Q96 318.4 156 214.5C216 110.6 272 201.3 312 132C352 62.7 390 66 390 66L390 330L0 330Z";

const onPanel = "#FFFFFF";
const onPanelSoft = "rgba(255, 255, 255, 0.85)";

function Notice({
  title,
  text,
  picture,
  action,
}: {
  readonly title: string;
  readonly text: string;
  readonly picture?: ReactNode;
  readonly action?: { readonly label: string; readonly onPress: () => void };
}) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.notice}>
      {picture}
      <Text variant="headline" weight="bold" style={styles.noticeTitle}>
        {title}
      </Text>
      <Text variant="subhead" style={styles.noticeText}>
        {text}
      </Text>
      {action === undefined ? null : (
        <View style={styles.noticeAction}>
          <Button small kind="quiet" icon="lock" label={action.label} onPress={action.onPress} />
        </View>
      )}
    </View>
  );
}

const inset = Tokens.layout.cardPadding;
const gap = Tokens.space.md;

const styles = StyleSheet.create({
  panel: {
    borderTopLeftRadius: Tokens.radius.panel,
    borderTopRightRadius: Tokens.radius.panel,
    paddingTop: Tokens.space.xl,
    paddingBottom: Tokens.space.xxxl,
    overflow: "hidden",
  },
  column: { width: "100%", maxWidth: Tokens.layout.contentMaxWidth, alignSelf: "center" },
  title: { color: onPanel, paddingHorizontal: inset + Tokens.space.xs },
  grid: { flexDirection: "column", gap, paddingHorizontal: inset, paddingTop: Tokens.space.lg },
  row: { flexDirection: "row", gap },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap,
    paddingHorizontal: inset,
    paddingTop: Tokens.space.lg,
  },
  // Three to a row in the content column, so a long German word still fits on its line.
  wide: { width: (Tokens.layout.contentMaxWidth - 2 * inset - 2 * gap) / 3 },
  notice: {
    alignItems: "center",
    gap: Tokens.space.xs,
    paddingHorizontal: inset,
    paddingTop: Tokens.space.xl,
    paddingBottom: Tokens.space.lg,
  },
  noticeTitle: { color: onPanel, textAlign: "center", marginTop: Tokens.space.sm },
  noticeText: { color: onPanelSoft, textAlign: "center" },
  noticeAction: { marginTop: Tokens.space.md },
});
