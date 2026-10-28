import Svg, { Path } from "react-native-svg";

// The few glyphs our own content draws. Chrome uses the platform's symbols instead.
const paths = {
  check: "M5 12.5l4.5 4.5L19 7.5",
  chevron: "M9.5 6l6 6-6 6",
  alert: "M12 7.5v6M12 17v.01",
} as const;

export interface IconProps {
  readonly name: keyof typeof paths;
  readonly color: string;
  readonly size?: number;
}

export function Icon({ name, color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={paths[name]}
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
