import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { TickedBox } from "@stu/ui/TickBox";
import { Tokens } from "@stu/ui/Tokens";
import { useLayout } from "@stu/ui/useLayout";
import { useLingeringOrder } from "@stu/ui/useLingeringOrder";
import { Vector } from "@stu/ui/Vector";
import type { ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { HomeworkCard } from "./HomeworkCard.tsx";
import type { HomeworkItem } from "./HomeworkItem.ts";

export interface HomeworkPanelProps {
  /** The homework to show, `undefined` while the device still reads it. */
  readonly items: ReadonlyArray<HomeworkItem.Item> | undefined;
  /**
   * The device has no key to the notebook. The panel says so, and the app's notice above the
   * screen offers to unlock.
   */
  readonly locked?: boolean;
  /** Ticks a homework done, or opens it again. */
  readonly onToggle: (id: string, done: boolean) => void;
  /** The app runs the panel to the screen's bottom. */
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * The Flutter app's blue "Hausaufgaben" panel with its darker wave, and a navy card per homework
 * (D67). Narrower than the wide breakpoint, up to three cards make one row and from four on two rows
 * scroll sideways, as Flutter's grid did. Wider, the cards stand in rows of three.
 */
export function HomeworkPanel({ items, locked, onToggle, style }: HomeworkPanelProps) {
  const { color } = Theme.useTheme();
  const screen = useWindowDimensions();
  const { layout, onLayout } = useLayout();
  // The panel spans the screen in the app, and a phone's frame on the landing page.
  const width = layout?.width ?? screen.width;
  const wide = width >= Tokens.layout.wideBreakpoint;
  const shown = useLingeringOrder(items ?? [], (item) => item.id, linger);

  return (
    <View onLayout={onLayout} style={[styles.panel, { backgroundColor: color.panel }, style]}>
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
        {locked === true ? (
          <Notice
            title="Dein Notizbuch ist gesperrt"
            text="Deine Hausaufgaben sind verschlüsselt. Entsperr dein Notizbuch, dann stehen sie hier."
          />
        ) : items === undefined ? null : shown.length === 0 ? (
          <Notice
            title="Keine Hausaufgaben offen"
            text="Genieß die freie Zeit!"
            picture={<TickedBox color={onPanel} size={44} />}
          />
        ) : wide ? (
          <View style={styles.wrap}>
            {shown.map((item) => (
              <HomeworkCard key={item.id} item={item} onToggle={onToggle} width={wideCard} />
            ))}
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.grid}
          >
            {rows(shown).map((row) => (
              <View key={row.key} style={styles.row}>
                {row.items.map((item) => (
                  <HomeworkCard
                    key={item.id}
                    item={item}
                    onToggle={onToggle}
                    width={narrowCard(width)}
                  />
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

// A ticked card stays in its place this long, for its pen stroke and a second thought, before it
// moves to the done ones at the end.
const linger = 1200;

// Legacy's AufgabenClipper on a 390 by 330 panel: down from the left edge, then up to the right.
const wave =
  "M0 198Q96 318.4 156 214.5C216 110.6 272 201.3 312 132C352 62.7 390 66 390 66L390 330L0 330Z";

const onPanel = "#FFFFFF";

const inset = Tokens.layout.cardPadding;
const gap = Tokens.space.md;

// A card takes 56 % of a phone's width, so about two thirds of the next column shows at its edge
// and says the row scrolls, as Flutter's did.
const narrowCard = (width: number) => Math.min(240, Math.max(196, Math.round(width * 0.56)));

// Three to a row in the content column.
const wideCard = (Tokens.layout.contentMaxWidth - 2 * inset - 2 * gap) / 3;

function Notice({
  title,
  text,
  picture,
}: {
  readonly title: string;
  readonly text: string;
  readonly picture?: ReactNode;
}) {
  const { color } = Theme.useTheme();

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.notice, { backgroundColor: color.panelCard }]}
    >
      {picture}
      <Text variant="headline" weight="bold" style={styles.noticeTitle}>
        {title}
      </Text>
      <Text variant="subhead" style={[styles.noticeText, { color: color.panelSoft }]}>
        {text}
      </Text>
    </View>
  );
}

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
  // The cards' navy, because small white text on the panel's blue is too faint to read.
  notice: {
    alignItems: "center",
    gap: Tokens.space.xs,
    marginHorizontal: inset,
    marginTop: Tokens.space.lg,
    borderRadius: Tokens.radius.tile + 6,
    padding: Tokens.space.xl,
  },
  noticeTitle: { color: onPanel, textAlign: "center", marginTop: Tokens.space.sm },
  noticeText: { textAlign: "center" },
});
