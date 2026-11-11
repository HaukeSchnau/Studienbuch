import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Blob } from "./Blob.tsx";
import { Drift } from "./Drift.tsx";
import { Text } from "./Text.tsx";
import { Theme } from "./Theme.ts";
import { Tokens } from "./Tokens.ts";
import { Underline } from "./Underline.tsx";
import { useLastLine } from "./useLastLine.ts";
import { useLayout } from "./useLayout.ts";
import { Vector } from "./Vector.tsx";

export interface HeroProps {
  readonly title: string;
  /** Draws the pen's underline under the title, as under "Moin, Lena!". */
  readonly underline?: boolean;
  readonly subtitle?: string | undefined;
  /** Short facts in white pills under the title, such as "KW 44". */
  readonly chips?: ReadonlyArray<string>;
  /** Under the subtitle and chips, such as the sync status. */
  readonly status?: ReactNode;
  /** Art at the right of the title, such as a subject's tile. It may overlap the swoosh. */
  readonly aside?: ReactNode;
  /** Our own toolbar row above the title on the web. Native toolbars float over `top` instead. */
  readonly toolbar?: { readonly start?: ReactNode; readonly end?: ReactNode };
  /** The space above the title: the status bar and the native toolbar row. */
  readonly top: number;
  /**
   * Reports how far down the colour reaches at the right edge, where the swoosh starts, so a screen
   * can tell when the status bar has left the colour.
   */
  readonly onColourEnd?: ((y: number) => void) | undefined;
  /** The colour of the screen the hero lies on, which the swoosh is cut in. `canvas` by default. */
  readonly canvas?: string | undefined;
  /** Content that starts on the band, such as cards. Whatever follows the hero starts below it. */
  readonly children?: ReactNode;
}

/**
 * The green header with legacy's swoosh and two darker blobs that breathe slowly. The colour is one
 * area, and the swoosh is painted over its bottom in the screen's colour, so no seam can open
 * between header and band at any width. Text and content sit in the content column.
 */
export function Hero({
  title,
  underline = false,
  subtitle,
  chips = [],
  status,
  aside,
  toolbar,
  top,
  onColourEnd,
  canvas,
  children,
}: HeroProps) {
  const { color } = Theme.useTheme();
  const swoosh = useSwoosh();
  const words = useLastLine();
  // The area extends this far below the text, where the band sits.
  const below = swoosh.band + edge - swoosh.lift;

  return (
    <View>
      <View
        style={[
          styles.area,
          { backgroundColor: color.hero, paddingTop: top, paddingBottom: below },
        ]}
        onLayout={(event) => {
          const { y, width, height } = event.nativeEvent.layout;

          swoosh.onArea(event);
          onColourEnd?.(y + height - bandFor(width) - edge);
        }}
      >
        <View style={styles.blobs}>
          <Drift motion="breathe" seconds={18} style={styles.blobStart}>
            <Blob form="twin" color={color.heroBlob} size={270} />
          </Drift>
          <Drift motion="breathe" seconds={24} offset={0.3} style={styles.blobEnd}>
            <Blob form="pinch" color={color.heroBlob} size={230} />
          </Drift>
        </View>
        <Swoosh band={swoosh.band} line={color.heroEdge} canvas={canvas ?? color.canvas} />
        {toolbar === undefined ? null : (
          <View style={[styles.column, styles.toolbar]}>
            <View style={styles.toolbarGroup}>{toolbar.start}</View>
            <View style={styles.toolbarGroup}>{toolbar.end}</View>
          </View>
        )}
        <View style={[styles.column, styles.heading]} onLayout={swoosh.onHeading}>
          <View style={styles.text} onLayout={swoosh.onText}>
            <View {...words.container}>
              <Text
                {...words.text}
                variant="display"
                accessibilityRole="header"
                style={styles.onHero}
              >
                {title}
              </Text>
              {underline && words.line !== undefined ? (
                <Underline line={words.line} color={color.heroPen} />
              ) : null}
            </View>
            {/* Bold, because white on the light hero green passes only as large bold text. */}
            {subtitle === undefined ? null : (
              <Text variant="title3" weight="bold" style={styles.onHero}>
                {subtitle}
              </Text>
            )}
            {chips.length === 0 ? null : (
              <View style={styles.chips}>
                {chips.map((chip) => (
                  <Text
                    key={chip}
                    variant="subhead"
                    weight="semibold"
                    style={[styles.chip, { backgroundColor: color.surface, color: color.accent }]}
                  >
                    {chip}
                  </Text>
                ))}
              </View>
            )}
            {status}
          </View>
          {aside}
        </View>
      </View>
      <View
        style={[
          styles.column,
          styles.content,
          { marginTop: heroGap - below, minHeight: below - heroGap },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

// The blue line under the swoosh is the curve again, this far lower.
const edge = 6;

// Content on the band starts this far below the hero's text.
const heroGap = 22;

const bandFor = (width: number) => Math.min(220, Math.max(150, Math.round(width * 0.13)));

const cubic = (a: number, b: number, c: number, d: number, t: number) =>
  (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d;

// Legacy's BezierClipper (lib/presentation/components/clippers.dart) as two cubic segments over the
// band, x across the width from 0 to 1 and y down the band from 0 to 1.
const segments = [
  { x: [0, 0.5, 0.5, 0.7], y: [1, 5 / 6, 1, 1 / 3] },
  { x: [0.7, 0.8, 1, 1], y: [1 / 3, 0, 0, 0] },
] as const;

/** How far down the band the curve is at `x`, from 1 at the left edge to 0 at the right. */
function depth(x: number) {
  const { x: xs, y: ys } = x <= 0.7 ? segments[0] : segments[1];
  let low = 0;
  let high = 1;

  // Both segments run left to right, so bisection on t finds the curve's point at x.
  for (let step = 0; step < 24; step++) {
    const middle = (low + high) / 2;

    if (cubic(xs[0], xs[1], xs[2], xs[3], middle) < x) low = middle;
    else high = middle;
  }

  return cubic(ys[0], ys[1], ys[2], ys[3], (low + high) / 2);
}

/**
 * Where the swoosh sits. Pass `onArea`, `onHeading` and `onText` to the coloured area, the heading row
 * and the text block. The curve then passes just under the text block's bottom right corner, so a
 * short greeting lets it rise as in legacy and a long name or a large text size pushes it down.
 * Until the first layout it assumes text that ends at 70 % of the width.
 */
export function useSwoosh() {
  const area = useLayout();
  const heading = useLayout();
  const text = useLayout();
  const band = bandFor(area.layout?.width ?? 0);

  const lift =
    area.layout === undefined || heading.layout === undefined || text.layout === undefined
      ? band / 3
      : Math.min(
          depth(
            Math.min(
              1,
              (heading.layout.x + text.layout.x + text.layout.width + reachPadding) /
                area.layout.width,
            ),
          ) * band,
          text.layout.height,
        );

  return {
    band,
    lift,
    onArea: area.onLayout,
    onHeading: heading.onLayout,
    onText: text.onLayout,
  };
}

// Room between the end of the text and the curve.
const reachPadding = 8;

/**
 * The band at the bottom of the coloured area: the blue line below the curve and the canvas below
 * that. Its x axis stretches with the width and its y axis doesn't, so the curve keeps legacy's
 * proportions and the line stays `edge` thick. It reaches a point past the area so no row of
 * green shows under it.
 */
function Swoosh({
  band,
  line,
  canvas,
}: {
  readonly band: number;
  readonly line: string;
  readonly canvas: string;
}) {
  const height = band + edge + 1;

  const below = (offset: number) =>
    [
      `M0 ${band + offset}`,
      `C500 ${(band * 5) / 6 + offset} 500 ${band + offset} 700 ${band / 3 + offset}`,
      `C800 ${offset} 1000 ${offset} 1000 ${offset}`,
      `L1000 ${height} L0 ${height}Z`,
    ].join(" ");

  return (
    <Vector
      style={styles.swoosh}
      width="100%"
      height={height}
      viewBox={`0 0 1000 ${String(height)}`}
      stretch
      paths={[
        { d: below(0), fill: line },
        { d: below(edge), fill: canvas },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  area: { position: "relative" },
  blobs: { ...StyleSheet.absoluteFill, overflow: "hidden", pointerEvents: "none" },
  // Where direction D's home puts them on a 390-point phone: one behind the title, one top right.
  blobStart: { position: "absolute", left: -120, top: -20 },
  blobEnd: { position: "absolute", right: -90, top: -90 },
  swoosh: { position: "absolute", left: 0, right: 0, bottom: -1 },
  column: { width: "100%", maxWidth: Tokens.layout.contentMaxWidth, alignSelf: "center" },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Tokens.space.sm,
    paddingHorizontal: Tokens.layout.gutter,
    marginBottom: Tokens.space.md,
  },
  toolbarGroup: { flexDirection: "row", alignItems: "center", gap: Tokens.space.sm },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Tokens.space.lg,
    paddingHorizontal: Tokens.layout.cardPadding,
  },
  text: { flexShrink: 1, gap: Tokens.space.xs },
  onHero: { color: "#FFFFFF" },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Tokens.space.sm,
    marginTop: Tokens.space.sm,
  },
  chip: {
    overflow: "hidden",
    borderRadius: Tokens.radius.pill,
    paddingHorizontal: Tokens.space.md,
    paddingVertical: Tokens.space.xs,
  },
  content: { paddingHorizontal: Tokens.layout.gutter, gap: Tokens.space.lg },
});
