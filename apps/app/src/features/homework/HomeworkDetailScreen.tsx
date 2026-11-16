import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { HomeworkDetail } from "@stu/domain-ui/homework/HomeworkDetail";
import { HomeworkItem } from "@stu/domain-ui/homework/HomeworkItem";
import { Button } from "@stu/ui/Button";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import * as Option from "effect/Option";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { confirm } from "../../ui/confirm.ts";
import { PanelScreen } from "../../ui/PanelScreen.tsx";
import { KeysState } from "../keys/KeysState.ts";
import { HomeworkRefusals } from "./HomeworkRefusals.tsx";
import { HomeworkRoutes } from "./HomeworkRoutes.ts";
import { HomeworkState } from "./HomeworkState.ts";
import { OfflineChip } from "./OfflineChip.tsx";

/**
 * One homework's page, opened from a card or a row: its whole title and text, done or open, and
 * the ways to edit and delete it. Delete asks first, in the system's alert on the phones.
 */
export function HomeworkDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return Option.match(KeysState.useAccountId(), {
    onNone: () => null,
    onSome: (accountId) => <AccountDetail accountId={accountId} id={id} />,
  });
}

function AccountDetail({ accountId, id }: { readonly accountId: string; readonly id: string }) {
  const router = useRouter();
  const { color } = Theme.useTheme();
  const status = useAtomValue(HomeworkState.status(accountId));
  const toggle = useAtomSet(HomeworkState.setDone(accountId));
  const remove = useAtomSet(HomeworkState.remove(accountId));

  if (Option.isNone(status)) {
    return <View style={[styles.blank, { backgroundColor: color.panel }]} />;
  }

  const { today, locked, readable, offline, reading } = status.value;
  const back = () => HomeworkRoutes.back(router, HomeworkRoutes.list);

  return (
    <PanelScreen title="Hausaufgaben" onBack={back} status={<OfflineChip offline={offline} />}>
      {Option.match(reading, {
        onNone: () => null,
        onSome: (value) => {
          const homework = value.homework.find((each) => each.id === id);

          const askToDelete = async (title: string) => {
            if (!(await confirm("Hausaufgabe löschen?", title, "Löschen"))) return;

            back();
            remove({ notebook: value.notebook, id });
          };

          return (
            <View style={styles.content}>
              <HomeworkRefusals accountId={accountId} reading={value} today={today} />
              {locked ? (
                <Notice title={HomeworkItem.locked.title} text={HomeworkItem.locked.text} />
              ) : !readable ? null : homework === undefined ? (
                <Notice
                  title="Diese Hausaufgabe gibt es nicht mehr"
                  text="Vielleicht wurde sie auf einem anderen Gerät gelöscht."
                  action={
                    <Button
                      small
                      kind="action"
                      label="Alle Hausaufgaben"
                      onPress={() => router.replace(HomeworkRoutes.list)}
                    />
                  }
                />
              ) : (
                <HomeworkDetail
                  detail={HomeworkItem.detail(homework, today)}
                  onToggle={(done) =>
                    toggle({ notebook: value.notebook, id, doneOn: done ? today : undefined })
                  }
                  onEdit={() => router.push(HomeworkRoutes.edit(id))}
                  onDelete={() => void askToDelete(homework.title)}
                />
              )}
            </View>
          );
        },
      })}
    </PanelScreen>
  );
}

function Notice({
  title,
  text,
  action,
}: {
  readonly title: string;
  readonly text: string;
  readonly action?: ReactNode;
}) {
  const { color } = Theme.useTheme();

  return (
    <View accessibilityLiveRegion="polite" style={styles.notice}>
      <Text variant="headline" weight="bold" style={styles.center}>
        {title}
      </Text>
      <Text variant="subhead" style={[styles.center, { color: color.inkSoft }]}>
        {text}
      </Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  blank: { flex: 1 },
  content: { gap: Tokens.space.lg },
  notice: { alignItems: "center", gap: Tokens.space.sm, paddingVertical: Tokens.space.xl },
  center: { textAlign: "center" },
});
