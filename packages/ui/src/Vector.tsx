import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";

export interface VectorPath {
  readonly d: string;
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
}

export interface VectorProps {
  readonly width: number | `${number}%`;
  readonly height: number | `${number}%`;
  readonly viewBox: string;
  /** Stretches the drawing to the box instead of keeping its aspect ratio, as the swoosh does. */
  readonly stretch?: boolean;
  readonly paths: ReadonlyArray<VectorPath>;
  readonly style?: StyleProp<ViewStyle>;
}

/**
 * A decorative drawing of paths: glyphs, the swoosh, the panel's fold. The phones draw it with
 * react-native-svg, the web with the DOM's own `<svg>` (Vector.web.tsx).
 */
export function Vector({ width, height, viewBox, stretch = false, paths, style }: VectorProps) {
  return (
    <View aria-hidden pointerEvents="none" style={[{ width, height }, style]}>
      <Svg
        width="100%"
        height="100%"
        viewBox={viewBox}
        preserveAspectRatio={stretch ? "none" : undefined}
      >
        {paths.map((path) => (
          <Path
            key={path.d}
            d={path.d}
            fill={path.fill ?? "none"}
            stroke={path.stroke}
            strokeWidth={path.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </Svg>
    </View>
  );
}
