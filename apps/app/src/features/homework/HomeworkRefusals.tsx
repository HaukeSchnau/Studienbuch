import { useAtom, useAtomSet } from "@effect/atom-react";
import type { CivilTime } from "@stu/core";
import { RefusalCard } from "@stu/domain-ui/refusal/RefusalCard";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as Schema from "effect/Schema";

import { HomeworkState } from "./HomeworkState.ts";
import { Refused } from "./Refused.ts";

/**
 * The refused changes to the notebook's homework as cards, on every homework screen: those the
 * server refused, and a tick or a delete this device refused itself. Each stays until the student
 * tries again or lets it go (sync.md, "Refusals stay visible").
 */
export function HomeworkRefusals({
  accountId,
  reading,
  today,
}: {
  readonly accountId: string;
  readonly reading: HomeworkState.Reading;
  readonly today: CivilTime.PlainDate;
}) {
  const [toggled, toggle] = useAtom(HomeworkState.setDone(accountId));
  const [removed, remove] = useAtom(HomeworkState.remove(accountId));
  const redo = useAtomSet(HomeworkState.redo(accountId));
  const dismiss = useAtomSet(HomeworkState.dismiss(accountId));
  const titles = new Map(reading.homework.map((each) => [each.id, each.title]));
  const notToggled = Option.filter(AsyncResult.error(toggled), Schema.is(HomeworkState.NotToggled));
  const notRemoved = Option.filter(AsyncResult.error(removed), Schema.is(HomeworkState.NotDeleted));

  return (
    <>
      {reading.refusals.map((rejected) => (
        <RefusalCard
          key={`${rejected.clientId} ${String(rejected.mutationId)}`}
          change={Refused.change(rejected, titles)}
          reason={rejected.reason}
          onRetry={() => redo(rejected)}
          onDismiss={() => dismiss(rejected)}
        />
      ))}
      {Option.match(notToggled, {
        onNone: () => null,
        onSome: (failed) => (
          <RefusalCard
            change={Refused.tick(failed.done, titles.get(failed.id))}
            reason={{ _tag: failed.reason }}
            onRetry={() =>
              toggle({
                notebook: reading.notebook,
                id: failed.id,
                doneOn: failed.done ? today : undefined,
              })
            }
            onDismiss={() => toggle(Atom.Reset)}
          />
        ),
      })}
      {Option.match(notRemoved, {
        onNone: () => null,
        onSome: (failed) => (
          <RefusalCard
            change={Refused.removal(titles.get(failed.id))}
            reason={{ _tag: failed.reason }}
            onRetry={() => remove({ notebook: reading.notebook, id: failed.id })}
            onDismiss={() => remove(Atom.Reset)}
          />
        ),
      })}
    </>
  );
}
