import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Blobs } from "./Blobs.ts";
import { Vector } from "./Vector.tsx";

export interface MarkerBlobProps {
  /** The blob's pastel. */
  readonly tint: string;
  /** Any whole number. It picks the outline and how it is turned, so a marker keeps its blob. */
  readonly seed: number;
  readonly size: number;
  /** What stands in the blob, centred: a sticker, a few letters or a glyph. */
  readonly children: ReactNode;
}

/** A soft pastel blob with art in its middle (brand direction A), as subjects and settings show. */
export function MarkerBlob({ tint, seed, size, children }: MarkerBlobProps) {
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
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  marker: { alignItems: "center", justifyContent: "center" },
  blob: { position: "absolute" },
});
