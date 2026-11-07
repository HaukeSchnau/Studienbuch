// The old web's two blob outlines (legacy-2026-10 apps/web/src/domain-ui/brand/blobs.tsx).

export * as Blobs from "./Blobs.ts";

export const outlines = {
  /** Sweeps in from the left edge. */
  green: {
    viewBox: "-21 0 351 540",
    d: "M-21 0C15.2535 9.43179 96.7897 42.9735 132.906 101.686C178.052 175.077 148.639 246.7 262.872 282.953C354.258 311.956 328.31 407.04 303.913 450.956C279.5 494.9 140 552 -21 520Z",
  },
  /** Hangs in from the right edge. */
  blue: {
    viewBox: "-10 -55 640 1100",
    d: "M617 -40.1C438.74 -51 68.96 -45.58 15.96 63.26C-50.3 199.32 105.43 273.53 196.27 239.96C287.11 206.39 373.85 221.4 279.6 489.09C204.19 703.24 453.08 937.59 586.95 1028Z",
  },
} as const;
