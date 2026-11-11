import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react";
import { DateText } from "@stu/domain-ui/calendar/DateText";
import { HomeworkPanel } from "@stu/domain-ui/homework/HomeworkPanel";
import { RefusalCard } from "@stu/domain-ui/refusal/RefusalCard";
import { Pill } from "@stu/ui/Pill";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as Schema from "effect/Schema";
import { useRouter } from "expo-router";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { HeroScreen } from "../../ui/HeroScreen.tsx";
import { HomeworkState } from "../homework/HomeworkState.ts";
import { Refused } from "../homework/Refused.ts";
import { KeysState } from "../keys/KeysState.ts";
import { OfflineChip } from "./OfflineChip.tsx";
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
  const wide = useWindowDimensions().width >= Tokens.layout.wideBreakpoint;
  const overview = useAtomValue(OverviewState.overview(accountId));
  const [toggled, toggle] = useAtom(HomeworkState.setDone(accountId));
  const redo = useAtomSet(HomeworkState.redo(accountId));
  const dismiss = useAtomSet(HomeworkState.dismiss(accountId));

  // Until the notebook is read, the canvas alone: a greeting without the name would flash first.
  if (Option.isNone(overview)) {
    return <View style={[styles.blank, { backgroundColor: color.canvas }]} />;
  }

  const { name, today, locked, offline, panel } = overview.value;

  const setDone = (id: string, done: boolean) =>
    Option.map(panel, ({ notebook }) => toggle({ notebook, id, doneOn: done ? today : undefined }));

  const notToggled = Option.filter(AsyncResult.error(toggled), Schema.is(HomeworkState.NotToggled));

  return (
    <HeroScreen
      title={Option.match(name, { onNone: () => "Moin!", onSome: (first) => `Moin, ${first}!` })}
      underline
      subtitle={DateText.long(today)}
      status={
        offline ? (
          <OfflineChip
            waiting={Option.match(panel, { onNone: () => 0, onSome: (p) => p.waiting })}
          />
        ) : null
      }
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
          <HomeworkPanel
            items={Option.getOrUndefined(Option.map(panel, (p) => p.items))}
            locked={locked ? { onUnlock: () => router.push("/notizbuch-entsperren") } : undefined}
            layout={wide ? "wrap" : "scroll"}
            onToggle={setDone}
            style={styles.panel}
          />
        ),
      }}
    >
      {Option.match(panel, {
        onNone: () => null,
        onSome: ({ refusals }) =>
          refusals.map(({ rejected, change }) => (
            <RefusalCard
              key={`${rejected.clientId} ${String(rejected.mutationId)}`}
              change={change}
              reason={rejected.reason}
              onRetry={() => redo(rejected)}
              onDismiss={() => dismiss(rejected)}
            />
          )),
      })}
      {Option.match(notToggled, {
        onNone: () => null,
        onSome: (failed) => (
          <RefusalCard
            change={Refused.tick(
              failed.done,
              Option.getOrUndefined(
                Option.flatMap(panel, (p) => Option.fromNullishOr(p.titles.get(failed.id))),
              ),
            )}
            reason={{ _tag: failed.reason }}
            onRetry={() => setDone(failed.id, failed.done)}
            onDismiss={() => toggle(Atom.Reset)}
          />
        ),
      })}
    </HeroScreen>
  );
}

const styles = StyleSheet.create({ blank: { flex: 1 }, panel: { flexGrow: 1 } });
