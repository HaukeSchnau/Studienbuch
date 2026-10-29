import { Hero, type HeroProps } from "@stu/ui/Hero";
import { Pill } from "@stu/ui/Pill";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import { Image, StyleSheet, View } from "react-native";

import { AbsenceCard } from "#/domain-ui/app/AbsenceCard.tsx";
import { AgendaCard } from "#/domain-ui/app/AgendaCard.tsx";
import { type Exam, GradesCard } from "#/domain-ui/app/GradesCard.tsx";
import { WeekGrid } from "#/domain-ui/app/WeekGrid.tsx";

import { Demo } from "./Demo.ts";

// The app's screens as the landing page shows them: the components with demo data, laid out the
// way variant B lays them out on a 390-point phone, under the status bar the phone frame draws.

function PhoneScreen(props: Omit<HeroProps, "top">) {
  const { color } = Theme.useTheme();

  return (
    <View style={[styles.screen, { backgroundColor: color.canvas }]}>
      <Hero top={props.toolbar === undefined ? 70 : 58} {...props} />
    </View>
  );
}

/** Übersicht: the day, the absences, and a way into each course. */
export function TodayScreen({ onOpen }: { onOpen?: (id: string) => void }) {
  return (
    <PhoneScreen subtitle="Das steht heute an:" title={`Moin, ${Demo.student}!`}>
      <AgendaCard onOpen={onOpen} rows={Demo.today} />
      <AbsenceCard days={1} unexcused={2} />
    </PhoneScreen>
  );
}

/** A course page with its grades. With `onBack`, it was opened from the Übersicht and leads back. */
export function CourseScreen({
  course,
  exams,
  onSign,
  onBack,
}: {
  course: Demo.CourseId;
  exams: ReadonlyArray<Exam>;
  onSign?: (id: string) => void;
  onBack?: () => void;
}) {
  const { color, elevation } = Theme.useTheme();
  const { name, teacher, term, oral } = Demo.courses[course];
  const art = Demo.art[course];

  return (
    <PhoneScreen
      aside={
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
      }
      chips={[term]}
      subtitle={teacher}
      title={name}
      toolbar={
        onBack === undefined
          ? undefined
          : {
              start: <Pill icon="back" label="Übersicht" onPress={onBack} />,
            }
      }
    >
      <GradesCard
        average={Demo.confirmedAverage(exams)}
        exams={exams}
        oral={oral}
        onSign={onSign}
      />
    </PhoneScreen>
  );
}

/** Meine Woche, with the arrows between weeks and "Heute" back to this one. */
export function WeekScreen({ week, onShow }: { week: number; onShow: (week: number) => void }) {
  const shown = Demo.weeks[week] ?? Demo.weeks[Demo.currentWeek];

  if (shown === undefined) return null;

  const arrow = (step: -1 | 1, label: string) => (
    <Pill
      disabled={Demo.weeks[week + step] === undefined}
      icon={step === -1 ? "back" : "chevron"}
      iconOnly
      label={label}
      onPress={() => onShow(week + step)}
    />
  );

  return (
    <PhoneScreen
      chips={[`KW ${String(shown.number)}`, shown.kind]}
      title="Meine Woche"
      toolbar={{
        end: (
          <>
            {arrow(-1, "Vorige Woche")}
            <Pill label="Heute" onPress={() => onShow(Demo.currentWeek)} />
            {arrow(1, "Nächste Woche")}
          </>
        ),
      }}
    >
      <WeekGrid
        cells={shown.cells}
        days={shown.days}
        now={shown.today === undefined ? undefined : Demo.now}
        periods={Demo.periods}
        today={shown.today}
      />
    </PhoneScreen>
  );
}

const styles = StyleSheet.create({
  screen: { width: 390, minHeight: "100%" },
  artTile: {
    width: 96,
    height: 96,
    borderRadius: Tokens.radius.tile + 4,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  art: { width: 62, height: 62 },
});
