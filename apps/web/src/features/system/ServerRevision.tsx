import { useAtomValue } from "@effect/atom-react";
import { RevisionCard } from "@stu/ui/RevisionCard";
import * as DateTime from "effect/DateTime";
import * as AsyncResult from "effect/reactivity/AsyncResult";

import { SystemClient } from "./SystemClient.ts";

const title = "Server";

/** The revision the server on this origin runs, from `System.info`. */
export function ServerRevision() {
  return AsyncResult.match(useAtomValue(SystemClient.info), {
    onInitial: () => <RevisionCard title={title} revision={undefined} />,
    onFailure: () => (
      <RevisionCard title={title} revision={undefined} problem="Server nicht erreichbar" />
    ),
    onSuccess: ({ value }) => (
      <RevisionCard
        title={title}
        revision={value.revision}
        badge={value.environment}
        details={[
          {
            label: "Serverzeit",
            value: DateTime.format(value.serverTime, {
              locale: "de-DE",
              timeZone: "Europe/Berlin",
              dateStyle: "medium",
              timeStyle: "medium",
            }),
          },
        ]}
      />
    ),
  });
}
