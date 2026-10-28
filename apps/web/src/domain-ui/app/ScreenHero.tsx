import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import type { ReactNode } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { Type } from "./Type.ts";

/**
 * Stand-in for the app's green hero with the swoosh (design-language.md, variant B), until M1
 * builds it in packages/domain-ui. The swoosh is a canvas-coloured box whose rounded corner and blue
 * border cut into the green: the legacy app draws a Bézier, and this needs no SVG library. The hero
 * is content and scrolls with the screen; the cards below pull up over its lower edge.
 */
export function ScreenHero({
  title,
  subtitle,
  chips = [],
  art,
  toolbar,
  height,
}: {
  title: string;
  subtitle?: string;
  chips?: ReadonlyArray<string>;
  /** A subject illustration shown in a white tile at the right, for a course. */
  art?: string;
  /** Buttons in a row above the title, at the right: our web chrome's place for them (variant B). */
  toolbar?: ReactNode;
  height: number;
}) {
  const { color, elevation } = Theme.useTheme();

  return (
    <View style={[styles.hero, { height, backgroundColor: color.hero }]}>
      <View
        style={[
          styles.swoosh,
          {
            top: height * 0.4,
            height,
            backgroundColor: color.canvas,
            borderColor: color.heroEdge,
          },
        ]}
      />
      <View style={[styles.band, { backgroundColor: color.heroEdge }]} />
      {toolbar === undefined ? null : <View style={styles.toolbar}>{toolbar}</View>}
      <Text style={[Type.style("display"), styles.onHero]}>{title}</Text>
      {subtitle === undefined ? null : (
        <Text style={[Type.style("title3"), styles.onHero, styles.subtitle]}>{subtitle}</Text>
      )}
      {chips.length === 0 ? null : (
        <View style={styles.chips}>
          {chips.map((chip) => (
            <Text
              key={chip}
              style={[
                Type.style("subhead"),
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
              top: height * 0.32,
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
  );
}

const styles = StyleSheet.create({
  hero: {
    overflow: "hidden",
    paddingTop: 66,
    paddingHorizontal: 22,
  },
  swoosh: {
    position: "absolute",
    left: "50%",
    width: "80%",
    borderTopLeftRadius: 160,
    borderTopWidth: 6,
    borderLeftWidth: 6,
  },
  band: { position: "absolute", left: 0, bottom: 0, width: "52%", height: 6 },
  toolbar: {
    flexDirection: "row",
    alignSelf: "flex-end",
    alignItems: "center",
    gap: Tokens.space.sm,
    marginTop: -10,
    marginBottom: Tokens.space.md,
  },
  onHero: { color: "#FFFFFF" },
  subtitle: { marginTop: Tokens.space.xs },
  chips: { flexDirection: "row", gap: Tokens.space.sm, marginTop: Tokens.space.md },
  chip: {
    overflow: "hidden",
    borderRadius: Tokens.radius.pill,
    paddingHorizontal: Tokens.space.md,
    paddingVertical: Tokens.space.xs,
    fontWeight: "800",
  },
  artTile: {
    position: "absolute",
    right: 18,
    width: 104,
    height: 104,
    borderRadius: Tokens.radius.card,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  art: { width: 68, height: 68 },
});
