// The stroked 24-point glyphs of apps/app/src/ui/Icon.tsx, as inline SVG: react-native-svg's web
// build imports TurboModuleRegistry, which react-native-web lacks, so Rolldown refuses it. M1 must
// resolve that (an alias, or a release without the import) before the landing page can use the app's
// components from packages/domain-ui.
const paths = {
  check: "M5 12.5l4.5 4.5L19 7.5",
  chevron: "M9.5 6l6 6-6 6",
  plus: "M12 5v14M5 12h14",
  back: "M14.5 6l-6 6 6 6",
  forward: "M9.5 6l6 6-6 6",
} as const;

export function Icon({
  name,
  color,
  size = 24,
}: {
  name: keyof typeof paths;
  color: string;
  size?: number;
}) {
  return (
    <svg aria-hidden height={size} viewBox="0 0 24 24" width={size}>
      <path
        d={paths[name]}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.4}
        style={{ stroke: color }}
      />
    </svg>
  );
}

/** The confirmation badge: a white tick in a filled circle. */
export function CheckBadge({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <svg aria-hidden height={size} viewBox="0 0 24 24" width={size}>
      <circle cx={12} cy={12} r={12} style={{ fill: color }} />
      <path
        d="M7 12.5l3.2 3.2L17 9"
        fill="none"
        stroke="#FFFFFF"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.8}
      />
    </svg>
  );
}

/** An open circle, for a signature still missing. */
export function OpenBadge({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <svg aria-hidden height={size} viewBox="0 0 24 24" width={size}>
      <circle cx={12} cy={12} fill="none" r={9.5} strokeWidth={2.6} style={{ stroke: color }} />
    </svg>
  );
}
