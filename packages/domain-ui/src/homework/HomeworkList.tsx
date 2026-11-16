import { Button } from "@stu/ui/Button";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { TickedBox } from "@stu/ui/TickBox";
import { Tokens } from "@stu/ui/Tokens";
import { useLingeringOrder } from "@stu/ui/useLingeringOrder";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { HomeworkItem } from "./HomeworkItem.ts";
import { HomeworkRow } from "./HomeworkRow.tsx";

export interface HomeworkListProps {
  /** `undefined` while the device still reads the homework. */
  readonly listing: HomeworkItem.Listing | undefined;
  /** The device has no key to the notebook, so the list only says so. */
  readonly locked?: boolean;
  readonly onToggle: (id: string, done: boolean) => void;
  readonly onOpen: (id: string) => void;
  /** Opens the sheet for a new homework. Absent while the notebook is locked. */
  readonly onAdd?: (() => void) | undefined;
}

/**
 * Every homework of the notebook in two parts, "Offen" and "Erledigt", as white rows on the page's
 * sheet. A ticked row stays in its place for a moment, as on the panel, before it changes parts.
 */
export function HomeworkList({ listing, locked, onToggle, onOpen, onAdd }: HomeworkListProps) {
  const { color } = Theme.useTheme();

  const entries: ReadonlyArray<Entry> =
    listing === undefined ? [] : [...listing.open, split, ...listing.done];

  const shown = useLingeringOrder(entries, idOf, linger);

  const at = shown.indexOf(split);

  const open = shown.slice(0, at).filter(isItem);
  const done = shown.slice(at + 1).filter(isItem);

  if (locked === true) {
    return <Notice title={HomeworkItem.locked.title} text={HomeworkItem.locked.text} />;
  }

  if (listing === undefined) return null;

  const rows = (items: ReadonlyArray<HomeworkItem.Item>) =>
    items.map((item, index) => (
      <HomeworkRow
        key={item.id}
        item={item}
        onToggle={onToggle}
        onOpen={onOpen}
        divided={index > 0}
      />
    ));

  return (
    <View style={styles.list}>
      <View>
        <Heading>Offen</Heading>
        {open.length === 0 ? (
          <Notice
            title="Keine Hausaufgaben offen"
            text="Genieß die freie Zeit!"
            picture={<TickedBox color={color.accent} size={44} />}
            onAdd={onAdd}
          />
        ) : (
          rows(open)
        )}
      </View>
      {done.length === 0 ? null : (
        <View>
          <Heading>Erledigt</Heading>
          {rows(done)}
        </View>
      )}
    </View>
  );
}

// Where the open part ends. Lingering on one sequence that holds it keeps a ticked row in its part
// until the order settles, because the sequence keeps its ids. No homework id is this word.
const split = "split";

type Entry = HomeworkItem.Item | typeof split;

const idOf = (entry: Entry) => (entry === split ? split : entry.id);

const isItem = (entry: Entry): entry is HomeworkItem.Item => entry !== split;

// As long as on the panel.
const linger = 1200;

function Heading({ children }: { readonly children: string }) {
  const { color } = Theme.useTheme();

  return (
    <Text
      variant="title2"
      accessibilityRole="header"
      aria-level={2}
      style={[styles.heading, { color: color.accent }]}
    >
      {children}
    </Text>
  );
}

function Notice({
  title,
  text,
  picture,
  onAdd,
}: {
  readonly title: string;
  readonly text: string;
  readonly picture?: ReactNode;
  readonly onAdd?: (() => void) | undefined;
}) {
  const { color } = Theme.useTheme();

  return (
    <View accessibilityLiveRegion="polite" style={styles.notice}>
      {picture}
      <Text variant="headline" weight="bold" style={styles.center}>
        {title}
      </Text>
      <Text variant="subhead" style={[styles.center, { color: color.inkSoft }]}>
        {text}
      </Text>
      {onAdd === undefined ? null : (
        <View style={styles.noticeAction}>
          <Button small kind="action" icon="plus" label="Hausaufgabe eintragen" onPress={onAdd} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Tokens.space.xl },
  heading: { marginBottom: Tokens.space.xs },
  notice: {
    alignItems: "center",
    gap: Tokens.space.xs,
    paddingVertical: Tokens.space.xl,
  },
  center: { textAlign: "center" },
  noticeAction: { marginTop: Tokens.space.md },
});
