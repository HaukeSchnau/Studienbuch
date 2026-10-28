import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Check } from "./Glyph.tsx";
import { Type } from "./Type.ts";

export interface Homework {
  readonly id: string;
  readonly subject: string;
  readonly title: string;
  readonly due: string;
  readonly done: boolean;
  /** Saved on the device and waiting for the server, as every change is while offline. */
  readonly pending: boolean;
}

/**
 * Stand-in for the app's blue homework panel with navy cards (design-language.md, section 1) until
 * M1 builds it in packages/domain-ui. Ticking calls `onToggle`; the caller owns the state. The app's
 * tick gets its spring from Reanimated; this one has the press scale only, because react-native-web's
 * Animated adds 113 KB of script to the landing page.
 */
export function HomeworkPanel({
  items,
  onToggle,
}: {
  items: ReadonlyArray<Homework>;
  onToggle: (id: string) => void;
}) {
  const { color } = Theme.useTheme();

  return (
    <View style={[styles.panel, { backgroundColor: color.panel }]}>
      <Text style={[Type.style("title1"), styles.title]}>Hausaufgaben</Text>
      {items.map((item) => (
        <HomeworkRow item={item} key={item.id} onToggle={onToggle} />
      ))}
    </View>
  );
}

function HomeworkRow({ item, onToggle }: { item: Homework; onToggle: (id: string) => void }) {
  const { color } = Theme.useTheme();

  return (
    <Pressable
      accessibilityLabel={`${item.subject}: ${item.title}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.done }}
      onPress={() => onToggle(item.id)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: color.panelCard },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.tick,
          item.done
            ? { backgroundColor: color.panelTitle, borderColor: color.panelTitle }
            : styles.open,
        ]}
      >
        {item.done ? <Check color={color.panelCard} size={20} /> : null}
      </View>
      <View style={[styles.grow, item.done && styles.done]}>
        <Text style={[Type.style("headline"), { color: color.panelTitle }]}>{item.subject}</Text>
        <Text style={[Type.style("callout"), styles.text, item.done && styles.struck]}>
          {item.title}
        </Text>
        <View style={styles.meta}>
          <Text style={[Type.style("footnote"), styles.due]}>{item.due}</Text>
          {item.pending ? (
            <Text
              style={[
                Type.style("footnote"),
                styles.pending,
                { backgroundColor: color.warningTint, color: color.warning },
              ]}
            >
              Wartet auf Netz
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: Tokens.radius.panel,
    padding: Tokens.space.lg,
    paddingTop: Tokens.space.xl,
    gap: Tokens.space.sm,
  },
  title: { color: "#FFFFFF", paddingHorizontal: Tokens.space.sm, marginBottom: Tokens.space.xs },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: Tokens.space.md,
    borderRadius: Tokens.radius.tile,
    padding: Tokens.space.lg,
    cursor: "pointer",
  },
  pressed: { transform: [{ scale: Tokens.motion.press.scale }] },
  tick: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  open: { borderColor: "rgba(255, 255, 255, 0.7)" },
  grow: { flex: 1, gap: 2 },
  done: { opacity: 0.6 },
  text: { color: "#FFFFFF" },
  struck: { textDecorationLine: "line-through" },
  meta: { flexDirection: "row", alignItems: "center", gap: Tokens.space.sm, marginTop: 2 },
  due: { color: "rgba(255, 255, 255, 0.78)" },
  pending: {
    overflow: "hidden",
    borderRadius: Tokens.radius.pill,
    paddingHorizontal: Tokens.space.sm,
    paddingVertical: 1,
  },
});
