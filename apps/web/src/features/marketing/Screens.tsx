import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AbsenceCard } from "#/domain-ui/app/AbsenceCard.tsx";
import { AgendaCard } from "#/domain-ui/app/AgendaCard.tsx";
import { Chevron } from "#/domain-ui/app/Glyph.tsx";
import { type Exam, GradesCard } from "#/domain-ui/app/GradesCard.tsx";
import { ScreenHero } from "#/domain-ui/app/ScreenHero.tsx";
import { Type } from "#/domain-ui/app/Type.ts";
import { WeekGrid } from "#/domain-ui/app/WeekGrid.tsx";

import { Demo } from "./Demo.ts";

// The app's screens as the landing page shows them: the stand-in components with demo data, laid
// out the way variant B lays them out on a 390-point phone.

/** Übersicht: the day, the absences, and a way into each course. */
export function TodayScreen({ onOpen }: { onOpen?: (id: string) => void }) {
  return (
    <View style={styles.screen}>
      <ScreenHero height={250} subtitle="Das steht heute an:" title={`Hallo, ${Demo.student}!`} />
      <View style={styles.cards}>
        <AgendaCard onOpen={onOpen} rows={Demo.today} />
        <AbsenceCard days={1} unexcused={2} />
      </View>
    </View>
  );
}

/** A course page with its grades. */
export function CourseScreen({
  course,
  exams,
  onSign,
}: {
  course: Demo.CourseId;
  exams: ReadonlyArray<Exam>;
  onSign?: (id: string) => void;
}) {
  const { name, teacher, term, oral } = Demo.courses[course];

  return (
    <View style={styles.screen}>
      <ScreenHero
        art={Demo.art[course]}
        chips={[term]}
        height={300}
        subtitle={teacher}
        title={name}
      />
      <View style={styles.cards}>
        <GradesCard
          average={Demo.confirmedAverage(exams)}
          exams={exams}
          oral={oral}
          onSign={onSign}
        />
      </View>
    </View>
  );
}

/** Meine Woche, with the arrows between weeks. */
export function WeekScreen({ week, onStep }: { week: number; onStep: (step: -1 | 1) => void }) {
  const shown = Demo.weeks[week] ?? Demo.weeks[0];
  const { color, elevation } = Theme.useTheme();

  if (shown === undefined) return null;

  const arrow = (step: -1 | 1, label: string) => {
    const target = Demo.weeks[week + step];

    return (
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        disabled={target === undefined}
        onPress={() => onStep(step)}
        style={({ pressed }) => [
          styles.arrow,
          { backgroundColor: color.surface, boxShadow: elevation.float },
          target === undefined ? styles.disabled : styles.pressable,
          pressed && styles.pressed,
        ]}
      >
        <View style={step === -1 && styles.flipped}>
          <Chevron color={color.accent} />
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <ScreenHero
        chips={[`KW ${String(shown.number)}`, shown.kind]}
        height={300}
        title="Meine Woche"
        toolbar={
          <>
            {arrow(-1, "Vorige Woche")}
            <Text
              style={[
                Type.style("headline"),
                styles.week,
                { backgroundColor: color.surface, color: color.accent, boxShadow: elevation.float },
              ]}
            >
              {shown.today === undefined ? "Nächste Woche" : "Diese Woche"}
            </Text>
            {arrow(1, "Nächste Woche")}
          </>
        }
      />
      <View style={[styles.cards, styles.weekCards]}>
        <WeekGrid
          cells={shown.cells}
          days={shown.days}
          now={shown.today === undefined ? undefined : Demo.now}
          periods={Demo.periods}
          today={shown.today}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { width: 390 },
  cards: { gap: Tokens.space.lg, marginTop: -64, paddingHorizontal: Tokens.layout.gutter },
  weekCards: { marginTop: -92 },
  arrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  week: {
    overflow: "hidden",
    borderRadius: Tokens.radius.pill,
    paddingHorizontal: Tokens.space.lg,
    paddingVertical: Tokens.space.sm,
  },
  flipped: { transform: [{ rotate: "180deg" }] },
  pressable: { cursor: "pointer" },
  disabled: { opacity: 0.4 },
  pressed: { transform: [{ scale: Tokens.motion.press.scale }] },
});
