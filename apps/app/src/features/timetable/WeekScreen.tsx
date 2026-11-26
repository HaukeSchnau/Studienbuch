import { useAtomValue } from "@effect/atom-react";
import { AgendaCard } from "@stu/domain-ui/timetable/AgendaCard";
import { DaySwitch } from "@stu/domain-ui/timetable/DaySwitch";
import { WeekGrid } from "@stu/domain-ui/timetable/WeekGrid";
import { Arrive } from "@stu/ui/Arrive";
import { Card } from "@stu/ui/Card";
import { Icon } from "@stu/ui/Icon";
import { MarkerBlob } from "@stu/ui/MarkerBlob";
import { Pill } from "@stu/ui/Pill";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import * as Option from "effect/Option";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { HeroScreen } from "../../ui/HeroScreen.tsx";
import { ArrowKeys } from "../../ui/ArrowKeys.tsx";
import { OfflineChip } from "../device-status/OfflineChip.tsx";
import { KeysState } from "../keys/KeysState.ts";
import { WeekState } from "./WeekState.ts";

/**
 * "Meine Woche", the Flutter app's week: the grid of the shown week under the green hero, with
 * "KW 47" and the school's "A-Woche", and arrows between weeks. At large text sizes a day list with
 * a day switcher takes the grid's place. A school without a timetable gets a card saying so.
 */
export function WeekScreen() {
  return Option.match(KeysState.useAccountId(), {
    onNone: () => <HeroScreen title="Meine Woche" />,
    onSome: (accountId) => <AccountWeek accountId={accountId} />,
  });
}

function AccountWeek({ accountId }: { readonly accountId: string }) {
  const router = useRouter();
  const { color } = Theme.useTheme();
  const { width, fontScale } = useWindowDimensions();
  // The shown week and the list's day live in the address: `?kw=2026-W48&tag=2026-11-26`.
  const { kw = "", tag } = useLocalSearchParams<{ kw?: string; tag?: string }>();
  const screen = useAtomValue(WeekState.screen(accountId)(kw));

  const show = (week: string | undefined) => router.setParams({ kw: week, tag: undefined });

  // Until the timetable is read, the canvas alone, so the hero's line doesn't change as it appears.
  if (Option.isNone(screen)) {
    return <View style={[styles.blank, { backgroundColor: color.canvas }]} />;
  }

  const { week, current, heading, chips, offline, card } = screen.value;
  const wide = width >= Tokens.layout.wideBreakpoint;
  const large = Tokens.layout.weekGridListAtFontScale;
  // Large text switches the grid to a day list. The web has no font scale, but zooming narrows
  // the window by the same factor, so a phone's browser at 135 % lists too.
  const list = fontScale >= large || width < Tokens.layout.phoneWidth / large;

  return (
    <HeroScreen
      title="Meine Woche"
      subtitle={heading}
      chips={chips}
      maxWidth={Tokens.layout.weekMaxWidth}
      status={<OfflineChip offline={offline} />}
      actions={
        <>
          <Pill icon="back" iconOnly label="Vorige Woche" onPress={() => show(week.previous)} />
          {current ? null : <Pill label="Heute" onPress={() => show(undefined)} />}
          <Pill icon="chevron" iconOnly label="Nächste Woche" onPress={() => show(week.next)} />
        </>
      }
    >
      <ArrowKeys left={() => show(week.previous)} right={() => show(week.next)} />
      <Arrive delay={110} style={styles.band}>
        {WeekState.Card.$match(card, {
          Reading: () => null,
          NoTimetable: () => <NoTimetable />,
          Week: (shown) => {
            if (!list) return <WeekGrid week={shown.week} wide={wide} stand={shown.stand} />;

            const chosen = shown.week.days.findIndex((day) => day.id === tag);
            const today = shown.week.days.findIndex((day) => day.today);
            const selected = chosen === -1 ? Math.max(today, 0) : chosen;
            const day = shown.days[selected];

            return (
              <>
                <DaySwitch
                  days={shown.week.days}
                  selected={selected}
                  onSelect={(index) => router.setParams({ tag: shown.week.days[index]?.id })}
                />
                <AgendaCard items={day?.items ?? []} notice={day?.notice} stand={shown.stand} />
              </>
            );
          },
        })}
      </Arrive>
    </HeroScreen>
  );
}

/** A school that hasn't brought its timetable into Studienbuch (D105, answer 5). */
function NoTimetable() {
  const { color, subject } = Theme.useTheme();

  return (
    <Card style={styles.empty}>
      <MarkerBlob tint={subject.green.tint} seed={1} size={64}>
        <Icon name="calendar" color={subject.green.text} size={32} />
      </MarkerBlob>
      <Text variant="title2" style={[styles.centred, { color: color.ink }]}>
        Noch kein Stundenplan
      </Text>
      <Text variant="callout" style={[styles.centred, { color: color.inkSoft }]}>
        Deine Schule stellt ihren Stundenplan noch nicht in Studienbuch bereit. Sobald sie das tut,
        stehen hier deine Stunden, mit Vertretungen und Ferien.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  blank: { flex: 1 },
  band: { gap: Tokens.space.md },
  empty: {
    alignItems: "center",
    gap: Tokens.space.sm,
    paddingHorizontal: Tokens.space.xl,
    paddingTop: 28,
    paddingBottom: 26,
  },
  centred: { textAlign: "center", maxWidth: 320 },
});
