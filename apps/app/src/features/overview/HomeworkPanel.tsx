import { HomeworkCard } from "@stu/domain-ui/homework/HomeworkCard";
import type { HomeworkItem } from "@stu/domain-ui/homework/HomeworkItem";
import { Blob } from "@stu/ui/Blob";
import { Button } from "@stu/ui/Button";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { useLingeringOrder } from "@stu/ui/useLingeringOrder";
import * as Option from "effect/Option";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";

export interface HomeworkPanelProps {
  readonly cards: ReadonlyArray<HomeworkItem.Item>;
  /** Ticks a homework done, or opens it again. */
  readonly onToggle: (homework: HomeworkItem.Item) => void;
  /**
   * The way to "Notizbuch entsperren", while this device has no key to the notebook. The panel then
   * says so, because "nichts auf" would be a guess.
   */
  readonly locked: Option.Option<() => void>;
}

/**
 * The blue "Hausaufgaben" panel that ends the Übersicht, as the Flutter app's BottomPanels drew it,
 * with a darker blob where legacy had a wave. One row of navy cards scrolls sideways on a phone and
 * wraps on a wide screen.
 */
export function HomeworkPanel({ cards, onToggle, locked }: HomeworkPanelProps) {
  const { color } = Theme.useTheme();
  const wide = useWindowDimensions().width >= Tokens.layout.wideBreakpoint;

  const row = useLingeringOrder(cards, (card) => card.id, settle).map((card) => (
    <HomeworkCard key={card.id} item={card} onToggle={() => onToggle(card)} />
  ));

  return (
    <View style={[styles.panel, { backgroundColor: color.panel }]}>
      <Blob form="kidney" turn={25} color={color.panelFold} size={330} style={styles.blob} />
      <View style={styles.column}>
        <Text variant="title1" accessibilityRole="header" aria-level={2} style={styles.title}>
          Hausaufgaben
        </Text>
        {Option.isSome(locked) ? (
          <Note
            title="Dein Notizbuch ist gesperrt."
            text="Deine Hausaufgaben sind verschlüsselt. Entsperr dein Notizbuch, dann stehen sie hier."
          >
            <Button small kind="quiet" icon="lock" label="Entsperren" onPress={locked.value} />
          </Note>
        ) : cards.length === 0 ? (
          <Note title="Du hast gerade nichts auf." text="Genieß es!" />
        ) : wide ? (
          <View style={[styles.cards, styles.wrap]}>{row}</View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cards}
          >
            {row}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

/** What the panel says instead of cards. Legacy's "keine Aufgaben gefunden" stood here. */
function Note({
  title,
  text,
  children,
}: {
  readonly title: string;
  readonly text: string;
  readonly children?: ReactNode;
}) {
  return (
    <View style={styles.note}>
      <Text variant="headline" weight="bold" style={styles.onPanel}>
        {title}
      </Text>
      <Text variant="callout" weight="semibold" style={styles.onPanel}>
        {text}
      </Text>
      {children === undefined ? null : <View style={styles.action}>{children}</View>}
    </View>
  );
}

// A ticked card stays in its place this long, for its pen stroke and a second thought, before it
// joins the done ones at the row's end.
const settle = 1200;

// Where the hero's text starts, so the panel's title stands under the greeting.
const inset = Tokens.layout.cardPadding;

const styles = StyleSheet.create({
  panel: {
    flexGrow: 1,
    borderTopLeftRadius: Tokens.radius.panel,
    borderTopRightRadius: Tokens.radius.panel,
    paddingTop: Tokens.space.xl,
    paddingBottom: Tokens.space.xxxl,
    overflow: "hidden",
  },
  blob: { position: "absolute", right: -90, top: 70 },
  column: { width: "100%", maxWidth: Tokens.layout.contentMaxWidth, alignSelf: "center" },
  // White on the panel passes only as large text.
  title: { color: "#FFFFFF", paddingHorizontal: inset },
  cards: { gap: Tokens.space.md, paddingHorizontal: inset, paddingTop: Tokens.space.lg },
  wrap: { flexDirection: "row", flexWrap: "wrap" },
  note: {
    alignItems: "center",
    gap: Tokens.space.xs,
    paddingHorizontal: inset,
    paddingVertical: Tokens.space.xl,
  },
  onPanel: { color: "#FFFFFF", textAlign: "center" },
  action: { marginTop: Tokens.space.md },
});
