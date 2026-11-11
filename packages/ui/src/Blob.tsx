import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { Blobs } from "./Blobs.ts";
import { Vector } from "./Vector.tsx";

export interface BlobProps {
  readonly form: Blobs.Form;
  readonly color: string;
  readonly size: number;
  /** Degrees the outline is turned, so two blobs of one shape don't look alike. */
  readonly turn?: number;
  readonly style?: StyleProp<ViewStyle>;
  /** What the blob holds, such as a subject's drawing. It stays upright, centred on the blob. */
  readonly children?: ReactNode;
}

/**
 * One of brand direction A's soft blobs: the pastel marker behind a subject's drawing, or a
 * decoration inside the hero and the homework panel. The outline reaches a little past `size`, as
 * a hand-cut shape would.
 */
export function Blob({ form, color, size, turn = 0, style, children }: BlobProps) {
  return (
    <View style={[styles.blob, { width: size, height: size }, style]}>
      <Vector
        style={[
          styles.outline,
          { left: -size * overhang, top: -size * overhang },
          { transform: [{ rotate: `${String(turn)}deg` }] },
        ]}
        width={size * (1 + 2 * overhang)}
        height={size * (1 + 2 * overhang)}
        viewBox="0 0 680 680"
        paths={[{ d: Blobs.forms[form], fill: color }]}
      />
      {children}
    </View>
  );
}

// The outline hangs over each edge of its box by this share of `size`.
const overhang = 0.06;

const styles = StyleSheet.create({
  blob: { alignItems: "center", justifyContent: "center" },
  outline: { position: "absolute" },
});
