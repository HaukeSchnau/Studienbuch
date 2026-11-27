import { Button } from "@stu/ui/Button";
import { Icon } from "@stu/ui/Icon";
import { PanelWave } from "@stu/ui/PanelWave";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { TickedBox } from "@stu/ui/TickBox";
import { Tokens } from "@stu/ui/Tokens";
import { useLayout } from "@stu/ui/useLayout";
import { useLingeringOrder } from "@stu/ui/useLingeringOrder";
import * as Arr from "effect/Array";
import type { ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { HomeworkCard } from "./HomeworkCard.tsx";
import { HomeworkItem } from "./HomeworkItem.ts";

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
  /** Opens a homework's page. */
  readonly onOpen: (id: string) => void;
  /** "Alle": the full list. */
  readonly onAll: () => void;
  /** "+": a new homework. Absent while the notebook is locked. */
  readonly onAdd?: (() => void) | undefined;
  /** The app runs the panel to the screen's bottom. */
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * The Flutter app's blue "Hausaufgaben" panel with its darker wave, and a navy card per homework
 * (D67). Narrower than the wide breakpoint, up to three cards make one row and from four on two rows
 * scroll sideways, as Flutter's grid did. Wider, the cards stand in rows of three.
 */
export function HomeworkPanel({
  items,
  locked,
  onToggle,
  onOpen,
  onAll,
  onAdd,
  style,
}: HomeworkPanelProps) {
  const { color } = Theme.useTheme();
  const screen = useWindowDimensions();
  const { layout, onLayout } = useLayout();
  // The panel spans the screen in the app, and a phone's frame on the landing page.
  const width = layout?.width ?? screen.width;
  const wide = width >= Tokens.layout.wideBreakpoint;
  const shown = useLingeringOrder(items ?? [], (item) => item.id, HomeworkItem.linger);

  return (
    <View onLayout={onLayout} style={[styles.panel, { backgroundColor: color.panel }, style]}>
      <PanelWave color={color.panelFold} />
      <View style={styles.column}>
        <View style={styles.head}>
          <Text variant="title1" accessibilityRole="header" aria-level={2} style={styles.title}>
            Hausaufgaben
          </Text>
          <PanelAction label="Alle" onPress={onAll} />
          {onAdd === undefined ? null : (
            <PanelAction label="Hausaufgabe hinzufügen" icon="plus" onPress={onAdd} />
          )}
        </View>
        {locked === true ? (
          <Notice title={HomeworkItem.locked.title} text={HomeworkItem.locked.text} />
        ) : items === undefined ? null : shown.length === 0 ? (
          <Notice
            title="Keine Hausaufgaben offen"
            text="Genieß die freie Zeit!"
            picture={<TickedBox color={onPanel} size={44} />}
            action={
              onAdd === undefined ? undefined : (
                <Button small kind="quiet" label="Hausaufgabe eintragen" onPress={onAdd} />
              )
            }
          />
        ) : wide ? (
          <View style={styles.wrap}>
            {shown.map((item) => (
              <HomeworkCard
                key={item.id}
                item={item}
                onToggle={onToggle}
                onOpen={onOpen}
                width={wideCard}
              />
            ))}
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.grid}
          >
            {columns(shown).map((column) => (
              <View key={column[0].id} style={styles.gridColumn}>
                {column.map((item) => (
                  <HomeworkCard
                    key={item.id}
                    item={item}
                    onToggle={onToggle}
                    onOpen={onOpen}
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

/**
 * Flutter's grid: one row up to three cards, else two rows filled column by column. Columns, not
 * rows, so screen readers and Tab follow the list's order.
 */
const columns = (items: ReadonlyArray<HomeworkItem.Item>) =>
  Arr.chunksOf(items, items.length < 4 ? 1 : 2);

const onPanel = "#FFFFFF";

const inset = Tokens.layout.cardPadding;
const gap = Tokens.space.md;

// A card takes 56 % of a phone's width, so about two thirds of the next column shows at its edge
// and says the row scrolls, as Flutter's did.
const narrowCard = (width: number) => Math.min(240, Math.max(196, Math.round(width * 0.56)));

// Three to a row in the content column.
const wideCard = (Tokens.layout.contentMaxWidth - 2 * inset - 2 * gap) / 3;

/** White on the panel, as the Flutter app's "+" beside the title: a word, or a glyph read out. */
function PanelAction({
  label,
  icon,
  onPress,
}: {
  readonly label: string;
  readonly icon?: "plus";
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed ? styles.pressed : null]}
    >
      {icon === undefined ? (
        <Text variant="headline" weight="bold" style={{ color: onPanel }}>
          {label}
        </Text>
      ) : (
        <Icon name={icon} color={onPanel} size={28} />
      )}
    </Pressable>
  );
}

function Notice({
  title,
  text,
  picture,
  action,
}: {
  readonly title: string;
  readonly text: string;
  readonly picture?: ReactNode;
  readonly action?: ReactNode;
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
      {action === undefined ? null : <View style={styles.noticeAction}>{action}</View>}
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
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: Tokens.space.xs,
    paddingLeft: inset + Tokens.space.xs,
    paddingRight: inset - Tokens.space.sm,
  },
  title: { flex: 1, color: onPanel },
  action: {
    minWidth: Tokens.layout.minTarget,
    minHeight: Tokens.layout.minTarget,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Tokens.space.sm,
    borderRadius: Tokens.radius.pill,
    cursor: "pointer",
  },
  pressed: { opacity: 0.6 },
  grid: { flexDirection: "row", gap, paddingHorizontal: inset, paddingTop: Tokens.space.lg },
  gridColumn: { gap },
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
  noticeAction: { marginTop: Tokens.space.md },
});
