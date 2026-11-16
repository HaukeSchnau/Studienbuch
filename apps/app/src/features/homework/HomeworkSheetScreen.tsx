import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Homework } from "@stu/core";
import { HomeworkForm } from "@stu/domain-ui/homework/HomeworkForm";
import { RefusalText } from "@stu/domain-ui/refusal/RefusalText";
import { Text } from "@stu/ui/Text";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as Schema from "effect/Schema";
import { useLocalSearchParams, useRouter } from "expo-router";

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

  if (Option.isNone(status) || Option.isNone(reading) || !AsyncResult.isSuccess(draft)) {
    return <Sheet onClose={close}>{null}</Sheet>;
  }

  const { today } = status.value;
  const { notebook } = reading.value;
  const stored = reading.value.homework.find((each) => each.id === id);

  if (id !== undefined && stored === undefined) {
    return (
      <Sheet onClose={close}>
        <Text variant="headline" weight="bold">
          Diese Hausaufgabe gibt es nicht mehr.
        </Text>
      </Sheet>
    );
  }

  const current: HomeworkInput.Current | undefined = stored;

  const values =
    draft.value ??
    (current === undefined ? HomeworkInput.empty : HomeworkInput.fromCurrent(current));

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
          : HomeworkState.Save.Update({ notebook, id, valid: ready, current }),
    });

    if (Exit.isSuccess(exit)) close();
  };

  return (
    <Sheet onClose={close}>
      <HomeworkForm
        heading={id === undefined ? "Hausaufgabe hinzufügen" : "Hausaufgabe bearbeiten"}
        values={values}
        onChange={setDraft}
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
