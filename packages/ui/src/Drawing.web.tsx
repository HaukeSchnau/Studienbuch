import { View } from "react-native";

import type { DrawingProps } from "./Drawing.tsx";

// A data URI holds markup as it is but for these. Escaping everything, as encodeURIComponent does,
// makes each sticker 28 % longer, and the prerendered landing page inlines every one it shows.
const unsafe = /[%#<>"]/gu;

/** Drawing.tsx on the web: the browser draws the markup as an image, without react-native-svg. */
export function Drawing({ xml, size }: DrawingProps) {
  return (
    <View aria-hidden pointerEvents="none" style={{ width: size, height: size }}>
      <img
        alt=""
        src={`data:image/svg+xml;charset=utf-8,${xml.replaceAll(unsafe, (char) => encodeURIComponent(char))}`}
        width={size}
        height={size}
        style={{ display: "block" }}
      />
    </View>
  );
}
