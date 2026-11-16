import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { DateText } from "@stu/domain-ui/calendar/DateText";
import { HomeworkPanel } from "@stu/domain-ui/homework/HomeworkPanel";
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
import { OverviewState } from "./OverviewState.ts";

/**
 * "Übersicht", the Flutter app's home: "Moin, Lena!" with today's date in the green hero, and the
 * blue homework panel below. From M2, "Heute" and "Morgen" come between the two. A refused change
 * waits as a card on the hero's band until the student picks what happens to it.
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

  const { name, today, locked, readable, offline, reading, panel } = overview.value;

  const setDone = (id: string, done: boolean) =>
    Option.map(panel, ({ notebook }) => toggle({ notebook, id, doneOn: done ? today : undefined }));

  return (
    <HeroScreen
      title={Option.match(name, { onNone: () => "Moin!", onSome: (first) => `Moin, ${first}!` })}
      underline
      subtitle={DateText.long(today)}
      status={<OfflineChip offline={offline} />}
      // The way to this device and to signing out, until Mein Profil holds them.
      aside={
        <Pill
          label="Dieses Gerät"
          icon="person"
          iconOnly
          onPress={() => router.push("/diagnose")}
        />
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
        {Option.match(reading, {
          onNone: () => null,
          onSome: (reading) => (
            <HomeworkRefusals accountId={accountId} reading={reading} today={today} />
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
