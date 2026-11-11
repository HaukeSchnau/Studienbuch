import { View } from "react-native";

import type { DrawingProps } from "./Drawing.tsx";

/** Drawing.tsx on the web: the browser draws the markup as an image, without react-native-svg. */
export function Drawing({ xml, size }: DrawingProps) {
  return (
    <View aria-hidden pointerEvents="none" style={{ width: size, height: size }}>
      <img
        alt=""
        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`}
        width={size}
        height={size}
        style={{ display: "block" }}
      />
    </View>
  );
}
