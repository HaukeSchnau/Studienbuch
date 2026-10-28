import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import type { ReactNode } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { Type } from "./Type.ts";

const band = { width: 390, height: 150, edge: 6 } as const;

// The curve of apps/app/src/ui/HeroScreen.tsx, which is legacy's BezierClipper: the band below the
// hero, its left edge running down, its right edge staying up. The blue line is the same curve,
// `band.edge` lower.
const curve = (offset: number) => {
  const w = band.width;
  const h = band.height - band.edge * 2;

  return [
    `M0 0 L0 ${h + offset}`,
    `C${w * 0.5} ${(h * 5) / 6 + offset} ${w * 0.5} ${h + offset} ${w * 0.7} ${h / 3 + offset}`,
    `C${w * 0.8} ${offset} ${w} ${offset} ${w} ${offset}`,
    `L${w} 0Z`,
  ].join(" ");
};

// The first card starts this far below the hero's text, on top of the band.
const heroGap = 22;

/**
 * Stand-in for the app's `HeroScreen` (apps/app/src/ui) as a phone on the landing page shows it,
 * without scrolling or safe areas: the green hero with the swoosh, and the cards on top of its
 * band. M1 moves the app's component into packages/domain-ui and the landing page uses that.
 */
export function HeroScreen({
  title,
  subtitle,
  chips = [],
  art,
  toolbar,
  children,
}: {
  title: string;
  subtitle?: string;
  chips?: ReadonlyArray<string>;
  /** A subject illustration in a white tile at the hero's right, for a course. */
  art?: string;
  /** Buttons above the title at the right, where our web chrome puts them (variant B). */
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  const { color, elevation } = Theme.useTheme();

  return (
    <View style={[styles.screen, { backgroundColor: color.canvas }]}>
      <View style={[styles.hero, { backgroundColor: color.hero }]}>
        {toolbar === undefined ? null : <View style={styles.toolbar}>{toolbar}</View>}
        <View style={art === undefined ? undefined : styles.besideArt}>
          <Text accessibilityRole="header" style={[Type.style("heroTitle"), styles.onHero]}>
            {title}
          </Text>
          {subtitle === undefined ? null : (
            <Text style={[Type.style("heroSubtitle"), styles.onHero]}>{subtitle}</Text>
          )}
        </View>
        {chips.length === 0 ? null : (
          <View style={styles.chips}>
            {chips.map((chip) => (
              <Text
                key={chip}
                style={[
                  Type.style("chip"),
                  styles.chip,
                  { backgroundColor: color.surface, color: color.accent },
                ]}
              >
                {chip}
              </Text>
            ))}
          </View>
        )}
        {art === undefined ? null : (
          <View
            style={[
              styles.artTile,
              {
                backgroundColor: color.surface,
                borderColor: color.cardEdge,
                boxShadow: elevation.float,
              },
            ]}
          >
            {/* `defaultSource` makes react-native-web render the image while prerendering. */}
            <Image defaultSource={{ uri: art }} source={{ uri: art }} style={styles.art} />
          </View>
        )}
      </View>
      {/* Inline SVG rather than react-native-svg, which doesn't bundle here yet (Icon.tsx). */}
      <svg
        aria-hidden
        height={band.height}
        preserveAspectRatio="none"
        // Overlaps the hero by a point, so no hairline of canvas shows between them.
        style={{ marginTop: -1 }}
        viewBox={`0 0 ${String(band.width)} ${String(band.height)}`}
        width="100%"
      >
        <path d={curve(band.edge)} style={{ fill: color.heroEdge }} />
        <path d={curve(0)} style={{ fill: color.hero }} />
      </svg>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { width: 390, minHeight: "100%" },
  hero: {
    paddingTop: 70,
    paddingHorizontal: Tokens.layout.cardPadding,
    gap: Tokens.space.xs,
  },
  toolbar: {
    flexDirection: "row",
    alignSelf: "flex-end",
    alignItems: "center",
    gap: Tokens.space.sm,
    marginTop: -Tokens.space.sm,
    marginBottom: Tokens.space.sm,
  },
  besideArt: { paddingRight: 120, gap: Tokens.space.xs },
  onHero: { color: "#FFFFFF" },
  chips: { flexDirection: "row", gap: Tokens.space.sm, marginTop: Tokens.space.sm },
  chip: {
    overflow: "hidden",
    borderRadius: Tokens.radius.pill,
    paddingHorizontal: Tokens.space.md,
    paddingVertical: Tokens.space.xs,
  },
  artTile: {
    position: "absolute",
    top: 74,
    right: Tokens.layout.cardPadding,
    width: 96,
    height: 96,
    borderRadius: Tokens.radius.tile + 4,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  art: { width: 62, height: 62 },
  content: {
    marginTop: heroGap - band.height,
    paddingHorizontal: Tokens.layout.gutter,
    gap: Tokens.space.lg,
  },
});
