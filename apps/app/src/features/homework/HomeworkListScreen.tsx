import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { HomeworkItem } from "@stu/domain-ui/homework/HomeworkItem";
import { HomeworkList } from "@stu/domain-ui/homework/HomeworkList";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import * as Option from "effect/Option";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { PanelScreen } from "../../ui/PanelScreen.tsx";
import { KeysState } from "../keys/KeysState.ts";
import { HomeworkRefusals } from "./HomeworkRefusals.tsx";
import { HomeworkRoutes } from "./HomeworkRoutes.ts";
import { HomeworkState } from "./HomeworkState.ts";
import { OfflineChip } from "../device-status/OfflineChip.tsx";

/**
 * "Alle" from the Übersicht's panel: every homework in "Offen" and "Erledigt" on the blue page of
 * homework, with "+" for a new one.
 */
export function HomeworkListScreen() {
  return Option.match(KeysState.useAccountId(), {
    onNone: () => null,
    onSome: (accountId) => <AccountList accountId={accountId} />,
  });
}

function AccountList({ accountId }: { readonly accountId: string }) {
  const router = useRouter();
  const { color } = Theme.useTheme();
  const status = useAtomValue(HomeworkState.screen(accountId));
  const toggle = useAtomSet(HomeworkState.setDone(accountId));

  if (Option.isNone(status)) {
    return <View style={[styles.blank, { backgroundColor: color.panel }]} />;
  }

  const { today, locked, readable, offline, reading } = status.value;
  const add = readable ? () => router.push(HomeworkRoutes.add) : undefined;

  return (
    <PanelScreen
      title="Hausaufgaben"
      onBack={() => HomeworkRoutes.back(router, "/")}
      action={
        add === undefined
          ? undefined
          : { label: "Hausaufgabe hinzufügen", icon: "plus", onPress: add }
      }
      status={<OfflineChip offline={offline} />}
    >
      {Option.match(reading, {
        // A locked device may hold no reading yet, as before the notebook row arrived.
        onNone: () =>
          locked ? (
            <HomeworkList listing={undefined} locked onToggle={ignore} onOpen={ignore} />
          ) : null,
        onSome: (value) => (
          <View style={styles.content}>
            <HomeworkRefusals
              accountId={accountId}
              reading={value}
              readable={readable}
              today={today}
            />
            <HomeworkList
              listing={readable ? HomeworkItem.list(value.homework, today) : undefined}
              locked={locked}
              onToggle={(id, done) =>
                toggle({ notebook: value.notebook, id, doneOn: done ? today : undefined })
              }
              onOpen={(id) => router.push(HomeworkRoutes.detail(id))}
              onAdd={add}
            />
          </View>
        ),
      })}
    </PanelScreen>
  );
}

// Nothing to tick or open while the list only says that the notebook is locked.
const ignore = () => undefined;

const styles = StyleSheet.create({
  blank: { flex: 1 },
  content: { gap: Tokens.space.lg },
});
