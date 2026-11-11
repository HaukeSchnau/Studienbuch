import { Pressable, StyleSheet, View } from "react-native";

import { Tokens } from "./Tokens.ts";
import { Vector } from "./Vector.tsx";
import { Wipe } from "./Wipe.tsx";

export interface TickBoxProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  /** What a screen reader says for the box, such as the homework's title. */
  readonly label: string;
  /** The pen's colour, white on the homework panel's navy cards. */
  readonly color: string;
  readonly size?: number;
}

/**
 * A box drawn by hand, ticked with one pen stroke that draws itself (brand direction D's "done by
 * you"). The touch area is the larger platform minimum around it.
 */
export function TickBox({ checked, onChange, label, color, size = 30 }: TickBoxProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      aria-checked={checked}
      accessibilityLabel={label}
      hitSlop={(Tokens.layout.minTarget - size) / 2}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [
        styles.box,
        { width: size, height: size },
        pressed ? styles.pressed : null,
      ]}
    >
      <Vector width={size} height={size} viewBox="0 0 32 32" paths={[box(color)]} />
      {checked ? (
        <View style={StyleSheet.absoluteFill}>
          <Wipe width={size} height={size} delay={0} duration={350}>
            <Vector width={size} height={size} viewBox="0 0 32 32" paths={[tick(color)]} />
          </Wipe>
        </View>
      ) : null}
    </Pressable>
  );
}

/** The box with its tick, drawn and not pressable, as a picture of something done. */
export function TickedBox({ color, size = 30 }: Pick<TickBoxProps, "color" | "size">) {
  return (
    <Vector width={size} height={size} viewBox="0 0 32 32" paths={[box(color), tick(color)]} />
  );
}

// A square with slightly uneven sides, and a tick whose long stroke leaves the box at the top.
const box = (color: string) => ({
  d: "M4.5 5.2C10 4 21 4.6 27.2 4.4C27.8 11 27.3 20 27.9 27.2C20.5 27.9 11 27.3 4.2 27.8C3.6 20.5 4.9 12 4.5 5.2Z",
  stroke: color,
  strokeWidth: 2.2,
});

const tick = (color: string) => ({
  d: "M8 16.5C10.5 18.5 12 20.5 13.5 23.5C16.5 16 21 10 28 5",
  stroke: color,
  strokeWidth: 3.2,
});

const styles = StyleSheet.create({
  box: { cursor: "pointer" },
  pressed: { transform: [{ scale: 0.9 }] },
});
