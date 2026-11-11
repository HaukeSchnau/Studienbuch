import { View } from "react-native";
import { SvgXml } from "react-native-svg";

export interface DrawingProps {
  /** A whole `<svg>` document with its own viewBox and colours. */
  readonly xml: string;
  readonly size: number;
}

/**
 * A coloured illustration from SVG markup, such as a subject's art. The phones parse it with
 * react-native-svg, the web hands it to the browser as an image (Drawing.web.tsx).
 */
export function Drawing({ xml, size }: DrawingProps) {
  return (
    <View aria-hidden pointerEvents="none" style={{ width: size, height: size }}>
      <SvgXml xml={xml} width="100%" height="100%" />
    </View>
  );
}
