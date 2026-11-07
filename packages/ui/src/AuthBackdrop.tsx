import type { ReactNode } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { Blobs } from "./Blobs.ts";
import { Drift } from "./Drift.tsx";
import { Theme } from "./Theme.ts";
import { Vector } from "./Vector.tsx";

// Where the old web's AuthShell put them, below and from its `sm` breakpoint.
const wide = 640;

export interface AuthBackdropProps {
  readonly children: ReactNode;
}

/**
 * The pale green canvas of the screens before an account is ready, with the old web's two pastel
 * blobs hanging in from the edges. They drift and breathe slowly, so the screen is never quite
 * still; with reduced motion they stay put. Its children lie above them and fill it.
 */
export function AuthBackdrop({ children }: AuthBackdropProps) {
  const { color } = Theme.useTheme();
  const large = useWindowDimensions().width >= wide;

  return (
    <View style={[styles.canvas, { backgroundColor: color.accentTint }]}>
      {/* A layer of their own, so a focused field never scrolls the page sideways to them. */}
      <View style={styles.blobs}>
        <Drift
          motion="drift"
          seconds={36}
          style={[styles.blob, styles.green, large ? styles.greenWide : null]}
        >
          <Drift motion="breathe" seconds={27} style={styles.fill}>
            <Blob outline={Blobs.outlines.green} fill={color.blobGreen} />
          </Drift>
        </Drift>
        <Drift
          motion="drift"
          seconds={36}
          style={[styles.blob, styles.blue, large ? styles.blueWide : null]}
        >
          <Drift motion="breathe" seconds={33} offset={0.4} style={styles.fill}>
            <Blob outline={Blobs.outlines.blue} fill={color.blobBlue} />
          </Drift>
        </Drift>
      </View>
      {children}
    </View>
  );
}

function Blob({
  outline,
  fill,
}: {
  readonly outline: { readonly viewBox: string; readonly d: string };
  readonly fill: string;
}) {
  return (
    <Vector width="100%" height="100%" viewBox={outline.viewBox} paths={[{ d: outline.d, fill }]} />
  );
}

const styles = StyleSheet.create({
  canvas: { flex: 1 },
  blobs: { ...StyleSheet.absoluteFill, overflow: "hidden", pointerEvents: "none" },
  blob: { position: "absolute", opacity: 0.45, pointerEvents: "none" },
  fill: { flex: 1 },
  green: { left: -96, top: "10%", width: 240, height: 384 },
  greenWide: { left: -112, width: 352, height: 544 },
  blue: { right: -96, bottom: "4%", width: 240, height: 416 },
  blueWide: { right: -112, width: 384, height: 608 },
});
