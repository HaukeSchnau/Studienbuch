import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { Pressable, StyleSheet, Text } from "react-native";

import { AbsenceCard } from "#/domain-ui/app/AbsenceCard.tsx";
import { AgendaCard } from "#/domain-ui/app/AgendaCard.tsx";
import { type Exam, GradesCard } from "#/domain-ui/app/GradesCard.tsx";
import { HeroScreen } from "#/domain-ui/app/HeroScreen.tsx";
import { Icon } from "#/domain-ui/app/Icon.tsx";
import { Type } from "#/domain-ui/app/Type.ts";
import { WeekGrid } from "#/domain-ui/app/WeekGrid.tsx";

import { Demo } from "./Demo.ts";

// The app's screens as the landing page shows them: the stand-in components with demo data, laid
// out the way variant B lays them out on a 390-point phone.

/** Übersicht: the day, the absences, and a way into each course. */
export function TodayScreen({ onOpen }: { onOpen?: (id: string) => void }) {
  return (
    <HeroScreen subtitle="Das steht heute an:" title={`Hallo, ${Demo.student}!`}>
      <AgendaCard onOpen={onOpen} rows={Demo.today} />
      <AbsenceCard days={1} unexcused={2} />
    </HeroScreen>
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
    <HeroScreen art={Demo.art[course]} chips={[term]} subtitle={teacher} title={name}>
      <GradesCard
        average={Demo.confirmedAverage(exams)}
        exams={exams}
        oral={oral}
        onSign={onSign}
      />
    </HeroScreen>
  );
}

/** Meine Woche, with the arrows between weeks and "Heute" back to this one. */
export function WeekScreen({ week, onShow }: { week: number; onShow: (week: number) => void }) {
  const { color, elevation } = Theme.useTheme();
  const shown = Demo.weeks[week] ?? Demo.weeks[Demo.currentWeek];

  if (shown === undefined) return null;

  const pill = { backgroundColor: color.surface, boxShadow: elevation.float };

  const arrow = (step: -1 | 1, label: string) => {
    const available = Demo.weeks[week + step] !== undefined;

    return (
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        disabled={!available}
        onPress={() => onShow(week + step)}
        style={({ pressed }) => [
          styles.arrow,
          pill,
          available ? styles.pressable : styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <Icon color={color.accent} name={step === -1 ? "back" : "forward"} size={22} />
      </Pressable>
    );
  };

  return (
    <HeroScreen
      chips={[`KW ${String(shown.number)}`, shown.kind]}
      title="Meine Woche"
      toolbar={
        <>
          {arrow(-1, "Vorige Woche")}
          <Pressable
            accessibilityRole="button"
            onPress={() => onShow(Demo.currentWeek)}
            style={({ pressed }) => [
              styles.today,
              pill,
              styles.pressable,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[Type.style("chip"), { color: color.accent }]}>Heute</Text>
          </Pressable>
          {arrow(1, "Nächste Woche")}
        </>
      }
    >
      <WeekGrid
        cells={shown.cells}
        days={shown.days}
        now={shown.today === undefined ? undefined : Demo.now}
        periods={Demo.periods}
        today={shown.today}
      />
    </HeroScreen>
  );
}

const styles = StyleSheet.create({
  arrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  today: {
    height: 40,
    justifyContent: "center",
    borderRadius: Tokens.radius.pill,
    paddingHorizontal: Tokens.space.lg,
  },
  pressable: { cursor: "pointer" },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: Tokens.motion.press.scale }] },
});
