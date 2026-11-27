import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { DateText } from "@stu/domain-ui/calendar/DateText";
import { HomeworkPanel } from "@stu/domain-ui/homework/HomeworkPanel";
import { AgendaCard } from "@stu/domain-ui/timetable/AgendaCard";
import { Arrive } from "@stu/ui/Arrive";
import { Pill } from "@stu/ui/Pill";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import * as Option from "effect/Option";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { HeroScreen } from "../../ui/HeroScreen.tsx";
import { HomeworkRefusals } from "../homework/HomeworkRefusals.tsx";
import { HomeworkRoutes } from "../homework/HomeworkRoutes.ts";
import { HomeworkState } from "../homework/HomeworkState.ts";
import { OfflineChip } from "../device-status/OfflineChip.tsx";
import { KeysState } from "../keys/KeysState.ts";
import { TimetableRoutes } from "../timetable/TimetableRoutes.ts";
import { OverviewState } from "./OverviewState.ts";

/**
 * "Übersicht", the Flutter app's home: "Moin, Lena!" and "Das steht heute an:" in the green hero,
 * the day's lessons on its band, each opening its lesson sheet, and the blue homework panel below.
 * Without a timetable the hero names today's date and the card stays away. A refused change waits
 * as a card on the band until the student picks what happens to it.
 */
export function OverviewScreen() {
  return Option.match(KeysState.useAccountId(), {
    onNone: () => <HeroScreen title="Moin!" subtitle="Schön, dass du da bist." />,
    onSome: (accountId) => <AccountOverview accountId={accountId} />,
  });
}

function AccountOverview({ accountId }: { readonly accountId: string }) {
  const router = useRouter();
  const { color } = Theme.useTheme();
  const overview = useAtomValue(OverviewState.overview(accountId));
  const toggle = useAtomSet(HomeworkState.setDone(accountId));

  // Until the notebook is read, the canvas alone: a greeting without the name would flash first.
  if (Option.isNone(overview)) {
    return <View style={[styles.blank, { backgroundColor: color.canvas }]} />;
  }

  const { name, today, locked, readable, offline, reading, panel, agenda } = overview.value;
  const card = Option.getOrUndefined(agenda)?.card;

  const setDone = (id: string, done: boolean) =>
    Option.map(panel, ({ notebook }) => toggle({ notebook, id, doneOn: done ? today : undefined }));

  return (
    <HeroScreen
      title={Option.match(name, { onNone: () => "Moin!", onSome: (first) => `Moin, ${first}!` })}
      underline
      subtitle={Option.match(agenda, {
        onNone: () => DateText.long(today),
        onSome: ({ heading }) => heading,
      })}
      status={<OfflineChip offline={offline} />}
      aside={
        <Pill label="Profil" icon="person" iconOnly onPress={() => router.navigate("/profil")} />
      }
      footer={{
        color: color.panelFold,
        children: (
          <Arrive delay={220} style={styles.grow}>
            <HomeworkPanel
              items={Option.getOrUndefined(panel)?.items}
              locked={locked}
              onToggle={setDone}
              onOpen={(id) => router.push(HomeworkRoutes.detail(id))}
              onAll={() => router.push(HomeworkRoutes.list)}
              onAdd={readable ? () => router.push(HomeworkRoutes.add) : undefined}
              style={styles.grow}
            />
          </Arrive>
        ),
      }}
    >
      <Arrive delay={110} style={styles.band}>
        {card === undefined ? null : (
          <AgendaCard
            items={card.items}
            notice={card.notice}
            stand={Option.getOrUndefined(agenda)?.stand}
            onOpen={(id) => router.push(TimetableRoutes.lesson(id))}
          />
        )}
        {Option.match(reading, {
          onNone: () => null,
          onSome: (reading) => (
            <HomeworkRefusals
              accountId={accountId}
              reading={reading}
              readable={readable}
              today={today}
            />
          ),
        })}
      </Arrive>
    </HeroScreen>
  );
}

const styles = StyleSheet.create({
  blank: { flex: 1 },
  band: { gap: Tokens.space.lg },
  grow: { flexGrow: 1 },
});
