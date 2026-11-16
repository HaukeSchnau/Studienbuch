import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Homework } from "@stu/core";
import { HomeworkForm } from "@stu/domain-ui/homework/HomeworkForm";
import { HomeworkItem } from "@stu/domain-ui/homework/HomeworkItem";
import { RefusalText } from "@stu/domain-ui/refusal/RefusalText";
import { Text } from "@stu/ui/Text";
import { Theme } from "@stu/ui/Theme";
import { Tokens } from "@stu/ui/Tokens";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as Schema from "effect/Schema";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Sheet } from "../../ui/Sheet.tsx";
import { KeysState } from "../keys/KeysState.ts";
import { HomeworkInput } from "./HomeworkInput.ts";
import { HomeworkRoutes } from "./HomeworkRoutes.ts";
import { HomeworkState } from "./HomeworkState.ts";

/**
 * The add sheet, and with an id the same sheet filled in to edit (D69). What the student types
 * stays in a draft until it is saved or "Abbrechen" drops it, so a sheet closed by mistake or an
 * app the system ended opens again as it was. "Speichern" closes it once this device saved.
 */
export function HomeworkSheetScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  return Option.match(KeysState.useAccountId(), {
    onNone: () => null,
    onSome: (accountId) => <AccountSheet accountId={accountId} id={id} />,
  });
}

function AccountSheet({
  accountId,
  id,
}: {
  readonly accountId: string;
  readonly id: string | undefined;
}) {
  const router = useRouter();
  const key = id ?? "new";
  const status = useAtomValue(HomeworkState.status(accountId));
  const [draft, setDraft] = useAtom(HomeworkState.draft(accountId)(key));
  const [saved, reset] = useAtom(HomeworkState.save(accountId));
  const save = useAtomSet(HomeworkState.save(accountId), { mode: "promiseExit" });
  const discard = useAtomSet(HomeworkState.discard(accountId), { mode: "promise" });

  // An edit ends on the homework's page, also when the sheet was opened by its address.
  const close = () => {
    reset(Atom.Reset);

    if (id === undefined) HomeworkRoutes.back(router, HomeworkRoutes.list);
    else router.dismissTo(HomeworkRoutes.detail(id));
  };

  const reading = Option.flatMap(status, (current) =>
    current.readable ? current.reading : Option.none(),
  );

  // Opened by its address on a device without the notebook's key, as after a reload.
  if (Option.exists(status, (current) => current.locked)) {
    return (
      <Sheet onClose={close}>
        <Notice title={HomeworkItem.locked.title} text={HomeworkItem.locked.text} />
      </Sheet>
    );
  }

  if (Option.isNone(status) || Option.isNone(reading) || !AsyncResult.isSuccess(draft)) {
    return <Sheet onClose={close}>{null}</Sheet>;
  }

  const { today } = status.value;
  const { notebook } = reading.value;
  const stored = reading.value.homework.find((each) => each.id === id);

  // Gone, as when another device deleted it. Its edit draft would never be read again.
  if (id !== undefined && stored === undefined) {
    return (
      <Sheet onClose={() => void discard(key).then(close)}>
        <Notice
          title="Diese Hausaufgabe gibt es nicht mehr"
          text="Vielleicht wurde sie auf einem anderen Gerät gelöscht."
        />
      </Sheet>
    );
  }

  const current: HomeworkInput.Current | undefined = stored;
  const touched = draft.value;
  const values = HomeworkInput.values(current, touched);

  const choices = HomeworkState.choices(reading.value, today, current?.courseId);

  const valid = HomeworkInput.decode(values, {
    today,
    offered: choices.map((choice) => choice.id),
    current,
  });

  const problem = Option.map(
    Option.filter(AsyncResult.error(saved), Schema.is(HomeworkState.Unsaved)),
    (unsaved) => RefusalText.sentence({ _tag: unsaved.reason }),
  );

  const submit = async (ready: HomeworkInput.Valid) => {
    const exit = await save({
      draft: key,
      save:
        current === undefined || id === undefined
          ? HomeworkState.Save.Create({ notebook, id: crypto.randomUUID(), valid: ready })
          : HomeworkState.Save.Update({ notebook, id, valid: ready, current, touched }),
    });

    if (Exit.isSuccess(exit)) close();
  };

  return (
    <Sheet onClose={close}>
      <HomeworkForm
        heading={id === undefined ? "Hausaufgabe hinzufügen" : "Hausaufgabe bearbeiten"}
        values={values}
        onChange={(changes) => setDraft({ ...touched, ...changes })}
        choices={choices}
        range={Homework.dueDates(today)}
        today={today}
        canSave={Option.isSome(valid)}
        problem={Option.getOrUndefined(problem)}
        onSave={() => Option.map(valid, (ready) => void submit(ready))}
        onCancel={() => void discard(key).then(close)}
      />
    </Sheet>
  );
}

function Notice({ title, text }: { readonly title: string; readonly text: string }) {
  const { color } = Theme.useTheme();

  return (
    <View accessibilityLiveRegion="polite" style={styles.notice}>
      <Text variant="headline" weight="bold">
        {title}
      </Text>
      <Text variant="callout" style={{ color: color.inkSoft }}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ notice: { gap: Tokens.space.sm } });
