import { StyleSheet, View } from "react-native";

import { Vector } from "./Vector.tsx";

/**
 * The darker wave across the blue homework surfaces, legacy's AufgabenClipper: down from the left
 * edge, then up to the right. It stretches over whatever box it fills.
 */
export function PanelWave({ color }: { readonly color: string }) {
  return (
    // A box of its own: the phones size an absolute child's 100 % without the padding.
    <View style={StyleSheet.absoluteFill}>
      <Vector
        width="100%"
        height="100%"
        viewBox="0 0 390 330"
        stretch
        paths={[{ d: wave, fill: color }]}
      />
    </View>
  );
}

const wave =
  "M0 198Q96 318.4 156 214.5C216 110.6 272 201.3 312 132C352 62.7 390 66 390 66L390 330L0 330Z";
