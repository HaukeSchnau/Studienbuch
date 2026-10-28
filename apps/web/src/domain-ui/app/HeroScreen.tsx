import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "./Icon.tsx";

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
  back,
  children,
}: {
  title: string;
  subtitle?: string;
  chips?: ReadonlyArray<string>;
  /** A subject illustration in a white tile at the hero's right, for a course. */
  art?: string;
  /** Buttons above the title at the right, where our web chrome puts them (variant B). */
  toolbar?: ReactNode;
  /** A pill at the top left that leads back, as the native stack's back button does. */
  back?: { readonly label: string; readonly onPress: () => void };
  children: ReactNode;
}) {
  const { color, elevation } = Theme.useTheme();

  return (
    <View style={[styles.screen, { backgroundColor: color.canvas }]}>
      <View style={[styles.hero, { backgroundColor: color.hero }]}>
        {back === undefined ? null : (
          <Pressable
            accessibilityLabel={`Zurück zur ${back.label}`}
            accessibilityRole="button"
            onPress={back.onPress}
            style={({ pressed }) => [
              styles.back,
              { backgroundColor: color.surface, boxShadow: elevation.float },
              pressed && styles.pressed,
            ]}
          >
            <Icon color={color.accent} name="back" size={20} />
            <Text style={[Type.style("chip"), { color: color.accent }]}>{back.label}</Text>
          </Pressable>
        )}
        {toolbar === undefined ? null : <View style={styles.toolbar}>{toolbar}</View>}
        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            <Text accessibilityRole="header" style={[Type.style("heroTitle"), styles.onHero]}>
              {title}
            </Text>
            {subtitle === undefined ? null : (
              <Text style={[Type.style("heroSubtitle"), styles.onHero]}>{subtitle}</Text>
            )}
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
          </View>
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
  back: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "center",
    gap: Tokens.space.xxs,
    height: 36,
    marginTop: -Tokens.space.sm,
    marginBottom: Tokens.space.md,
    paddingLeft: Tokens.space.sm,
    paddingRight: Tokens.space.md + Tokens.space.xxs,
    borderRadius: Tokens.radius.pill,
    cursor: "pointer",
  },
  pressed: { transform: [{ scale: Tokens.motion.press.scale }] },
  toolbar: {
    flexDirection: "row",
    alignSelf: "flex-end",
    alignItems: "center",
    gap: Tokens.space.sm,
    marginTop: -Tokens.space.sm,
    marginBottom: Tokens.space.sm,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: Tokens.space.lg },
  titleText: { flex: 1, gap: Tokens.space.xs },
  onHero: { color: "#FFFFFF" },
  chips: { flexDirection: "row", gap: Tokens.space.sm, marginTop: Tokens.space.sm },
  chip: {
    overflow: "hidden",
    borderRadius: Tokens.radius.pill,
    paddingHorizontal: Tokens.space.md,
    paddingVertical: Tokens.space.xs,
  },
  artTile: {
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
