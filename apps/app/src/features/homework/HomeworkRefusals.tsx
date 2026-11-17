import { useAtom, useAtomSet } from "@effect/atom-react";
import type { CivilTime } from "@stu/core";
import { RefusalCard } from "@stu/domain-ui/refusal/RefusalCard";

import { HomeworkState } from "./HomeworkState.ts";
import { LocalRefusals } from "./LocalRefusals.ts";
import { Refused } from "./Refused.ts";

/**
 * The refused changes to the notebook's homework as cards, on every homework screen: those the
 * server refused, and a tick or a delete this device refused itself. Each stays until the student
 * tries again or lets it go (sync.md, "Refusals stay visible").
 */
export function HomeworkRefusals({
  accountId,
  reading,
  readable,
  today,
}: {
  readonly accountId: string;
  readonly reading: HomeworkState.Reading;
  /** Whether the device holds the notebook's key. Without it, this device's own refusals wait. */
  readonly readable: boolean;
  readonly today: CivilTime.PlainDate;
}) {
  const toggle = useAtomSet(HomeworkState.setDone(accountId));
  const remove = useAtomSet(HomeworkState.remove(accountId));
  const [local, setLocal] = useAtom(HomeworkState.localRefusals(accountId));
  const redo = useAtomSet(HomeworkState.redo(accountId));
  const dismiss = useAtomSet(HomeworkState.dismiss(accountId));
  const titles = new Map(reading.homework.map((each) => [each.id, each.title]));

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
      {Refused.local(local, titles, readable).map(({ refused, change }) => (
        <RefusalCard
          key={`${refused._tag} ${refused.id}`}
          change={change}
          reason={{ _tag: refused.reason }}
          onRetry={() =>
            refused._tag === "HomeworkState.NotToggled"
              ? toggle({
                  notebook: reading.notebook,
                  id: refused.id,
                  doneOn: refused.done ? today : undefined,
                })
              : remove({ notebook: reading.notebook, id: refused.id })
          }
          onDismiss={() => setLocal(LocalRefusals.dismiss(local, refused))}
        />
      ))}
    </>
  );
}
