import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { DateText } from "@stu/domain-ui/date/DateText";
import { HomeworkItem } from "@stu/domain-ui/homework/HomeworkItem";
import { RefusalCard } from "@stu/domain-ui/refusal/RefusalCard";
import { Arrive } from "@stu/ui/Arrive";
import { Card } from "@stu/ui/Card";
import { Link } from "@stu/ui/Link";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { Link as RouteLink, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { HeroScreen } from "../../ui/HeroScreen.tsx";
import { KeysState } from "../keys/KeysState.ts";
import { HomeworkPanel } from "./HomeworkPanel.tsx";
import { Overview } from "./Overview.ts";
import { OverviewState } from "./OverviewState.ts";
import { SyncChip } from "./SyncChip.tsx";

/**
 * "Übersicht", the Flutter app's home: "Moin, Lena!" in the green hero with today's date, and the
 * blue homework panel at the screen's end. The band between them holds what needs the student now,
 * a change that wasn't taken over, and from M2 the cards for today's and tomorrow's lessons.
 */
export function OverviewScreen() {
  return Option.match(KeysState.useAccountId(), {
    onNone: () => <Blank />,
    onSome: (accountId) => <AccountOverview accountId={accountId} />,
  });
}

function AccountOverview({ accountId }: { readonly accountId: string }) {
  const router = useRouter();
  const { color } = Theme.useTheme();
  const reading = AsyncResult.value(useAtomValue(OverviewState.reading(accountId)));
  const keys = AsyncResult.value(useAtomValue(KeysState.status(accountId)));
  const connection = AsyncResult.value(useAtomValue(OverviewState.connection(accountId)));
  const failed = useAtomValue(OverviewState.failed(accountId));
  const forget = useAtomSet(OverviewState.failed(accountId));
  const tick = useAtomSet(OverviewState.tick(accountId));
  const redo = useAtomSet(OverviewState.redo(accountId));
  const dismiss = useAtomSet(OverviewState.dismiss(accountId));

  // Until the notebook is read, the canvas alone: a greeting without the name would flash first.
  if (Option.isNone(reading)) return <Blank />;

  const { notebook, name, today, homework, refused } = reading.value;

  return (
    <HeroScreen
      title={Overview.greeting(name)}
      underline
      subtitle={DateText.long(today)}
      status={Option.match(Option.flatMap(connection, Overview.chip), {
        onNone: () => null,
        onSome: (words) => <SyncChip>{words}</SyncChip>,
      })}
      footer={{
        color: color.panel,
        content: (
          <Arrive delay={220} style={styles.grow}>
            <HomeworkPanel
              cards={HomeworkItem.panel(homework, today)}
              locked={
                Option.exists(keys, (now) => now._tag === "Locked")
                  ? Option.some(() => router.push("/notizbuch-entsperren"))
                  : Option.none()
              }
              onToggle={(card) => {
                if (Option.isNone(notebook)) return;

                tick({
                  notebook: notebook.value,
                  id: card.id,
                  doneOn: card.done ? undefined : today,
                  change: Overview.ticking(card),
                });
              }}
            />
          </Arrive>
        ),
      }}
    >
      <Arrive delay={110} style={styles.band}>
        {Option.match(failed, {
          onNone: () => null,
          onSome: ({ change, reason }) => (
            <RefusalCard change={change} reason={reason} onDismiss={() => forget(Option.none())} />
          ),
        })}
        {refused.map((each) => {
          const change = Overview.describe(each, homework);

          return (
            <RefusalCard
              key={`${each.clientId} ${String(each.mutationId)}`}
              change={change}
              reason={each.reason}
              onRetry={() => redo({ refused: each, change })}
              onDismiss={() => dismiss(each)}
            />
          );
        })}
        <DeviceCard />
      </Arrive>
    </HeroScreen>
  );
}

function Blank() {
  const { color } = Theme.useTheme();

  return <View style={[styles.grow, { backgroundColor: color.appCanvas }]} />;
}

/** The way to "Dieses Gerät", where the student also signs out, until "Mein Profil" exists. */
function DeviceCard() {
  const { color } = Theme.useTheme();

  return (
    <Card padded title="Dieses Gerät">
      <Text style={{ color: color.inkSoft }}>
        Verbindung, Verschlüsselung und Speicher prüfen. Dort meldest du dich auch ab.
      </Text>
      <RouteLink href="/diagnose" asChild>
        <Link label="Öffnen" variant="subhead" />
      </RouteLink>
    </Card>
  );
}

const styles = StyleSheet.create({
  grow: { flexGrow: 1 },
  band: { gap: Tokens.space.lg },
});
