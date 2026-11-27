import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { LessonSheet } from "@stu/domain-ui/timetable/LessonSheet";
import { Button } from "@stu/ui/Button";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import * as Option from "effect/Option";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Sheet } from "../../ui/Sheet.tsx";
import { HomeworkRoutes } from "../homework/HomeworkRoutes.ts";
import { HomeworkState } from "../homework/HomeworkState.ts";
import { KeysState } from "../keys/KeysState.ts";
import { LessonState } from "./LessonState.ts";

/**
 * The lesson sheet, opened from a lesson on the Übersicht or in Meine Woche: the system's sheet on
 * the phones, our dialog on the wide web. "Hausaufgabe eintragen" and a homework row take its place,
 * so one sheet shows at a time and back leads to the tab it opened from.
 */
export function LessonSheetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return Option.match(KeysState.useAccountId(), {
    onNone: () => null,
    onSome: (accountId) => <AccountLesson accountId={accountId} id={id} />,
  });
}

function AccountLesson({ accountId, id }: { readonly accountId: string; readonly id: string }) {
  const router = useRouter();
  const sheet = useAtomValue(LessonState.sheet(accountId)(id));
  const toggle = useAtomSet(HomeworkState.setDone(accountId));
  const close = () => HomeworkRoutes.back(router, "/");

  return LessonState.Sheet.$match(sheet, {
    // A way out only: an empty sheet would trap the focus on nothing.
    Reading: () => (
      <Sheet label="Stunde" onClose={close}>
        <Button small kind="secondary" label="Schließen" onPress={close} />
      </Sheet>
    ),
    Gone: () => (
      <Sheet label="Stunde" onClose={close}>
        <Gone onClose={close} />
      </Sheet>
    ),
    Lesson: ({ today, detail, homework, notebook, add }) => (
      <Sheet label={detail.subject} onClose={close}>
        <LessonSheet
          lesson={detail}
          homework={homework}
          onToggle={(homeworkId, done) => {
            if (notebook !== undefined) {
              toggle({ notebook, id: homeworkId, doneOn: done ? today : undefined });
            }
          }}
          onOpenHomework={(homeworkId) => router.replace(HomeworkRoutes.detail(homeworkId))}
          onAdd={
            add === undefined
              ? undefined
              : () => router.replace(HomeworkRoutes.addFor(add.courseId, add.dueOn))
          }
          onClose={close}
        />
      </Sheet>
    ),
  });
}

function Gone({ onClose }: { readonly onClose: () => void }) {
  const { color } = Theme.useTheme();

  return (
    <View accessibilityLiveRegion="polite" style={styles.gone}>
      <Text variant="headline" weight="bold">
        Diese Stunde steht nicht mehr im Plan
      </Text>
      <Text variant="callout" style={{ color: color.inkSoft }}>
        Vielleicht hat die Schule den Plan geändert.
      </Text>
      <View style={styles.close}>
        <Button small kind="secondary" label="Schließen" onPress={onClose} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gone: { gap: Tokens.space.sm },
  close: { alignItems: "flex-end", marginTop: Tokens.space.sm },
});
