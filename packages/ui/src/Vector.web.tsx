import { View } from "react-native";

import type { VectorProps } from "./Vector.tsx";

/**
 * Vector.tsx on the web, with the DOM's own `<svg>`. react-native-svg's web build would add 10 KB
 * gzip to the landing page for the same paths. Colours may be CSS variables, which browsers resolve
 * in SVG's presentation attributes.
 */
export function Vector({ width, height, viewBox, stretch = false, paths, style }: VectorProps) {
  return (
    <View aria-hidden pointerEvents="none" style={[{ width, height }, style]}>
      <svg
        width="100%"
        height="100%"
        viewBox={viewBox}
        preserveAspectRatio={stretch ? "none" : undefined}
        style={{ display: "block" }}
      >
        {paths.map((path) => (
          <path
            key={path.d}
            d={path.d}
            fill={path.fill ?? "none"}
            stroke={path.stroke}
            strokeWidth={path.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
    </View>
  );
}
