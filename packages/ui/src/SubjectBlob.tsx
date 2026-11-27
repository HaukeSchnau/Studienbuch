import { StyleSheet } from "react-native";

import { Drawing } from "./Drawing.tsx";
import { MarkerBlob } from "./MarkerBlob.tsx";
import { Text } from "./Text.tsx";

export interface SubjectBlobProps {
  /** A sticker (Sticker.ts) as a whole `<svg>` document. Without one, `label` stands in the blob. */
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

/**
 * A subject's or a grade kind's marker: its sticker on a soft pastel blob (brand direction A), the
 * same on every screen.
 */
export function SubjectBlob({ drawing, label, tint, ink, seed, size = 36 }: SubjectBlobProps) {
  return (
    <MarkerBlob tint={tint} seed={seed} size={size}>
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
        // The sticker brings its own white edge, so it may reach past the blob.
        <Drawing xml={drawing} size={Math.round(size * 0.78)} />
      )}
    </MarkerBlob>
  );
}

const styles = StyleSheet.create({
  label: { textAlign: "center" },
});
