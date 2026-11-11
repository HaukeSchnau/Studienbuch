import { StyleSheet, View } from "react-native";

import { Blobs } from "./Blobs.ts";
import { Drawing } from "./Drawing.tsx";
import { Text } from "./Text.tsx";
import { Vector } from "./Vector.tsx";

export interface SubjectBlobProps {
  /** The art as a whole `<svg>` document. Without one, `label` stands in the blob. */
  readonly drawing: string | undefined;
  /** Two or three letters, such as "PW", for a subject without art. */
  readonly label: string;
  /** The blob's pastel. */
  readonly tint: string;
  /** The colour of `label` on the tint. */
  readonly ink: string;
  /** Any whole number. It picks the outline and how it is turned, so a subject keeps its blob. */
  readonly seed: number;
  readonly size?: number;
}

/** A subject's marker: its art on a soft pastel blob (brand direction A), the same on every screen. */
export function SubjectBlob({ drawing, label, tint, ink, seed, size = 36 }: SubjectBlobProps) {
  const outline = Blobs.markers.outlines[seed % Blobs.markers.outlines.length] ?? "";
  const turn = (Math.floor(seed / Blobs.markers.outlines.length) % 12) * 30;

  return (
    <View aria-hidden style={[styles.marker, { width: size, height: size }]}>
      <View
        style={[
          styles.blob,
          {
            top: -size * 0.06,
            left: -size * 0.06,
            width: size * 1.12,
            height: size * 1.12,
            transform: [{ rotate: `${String(turn)}deg` }],
          },
        ]}
      >
        <Vector
          width="100%"
          height="100%"
          viewBox={Blobs.markers.viewBox}
          paths={[{ d: outline, fill: tint }]}
        />
      </View>
      {drawing === undefined ? (
        <Text
          variant="caption"
          numberOfLines={1}
          maxFontSizeMultiplier={1}
          style={[styles.label, { color: ink, fontSize: Math.round(size * 0.34) }]}
        >
          {label}
        </Text>
      ) : (
        <Drawing xml={drawing} size={Math.round(size * 0.56)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  marker: { alignItems: "center", justifyContent: "center" },
  blob: { position: "absolute" },
  label: { textAlign: "center" },
});
