/**
 * A scripted server for the engine's tests: each push and pull takes the next answer of its script,
 * and the requests stay for the test to check. With pages of the test domain: Lena's notebook and
 * a school with five courses.
 */
import * as Effect from "effect/Effect";
import type * as Schema from "effect/Schema";
import { Protocol } from "../../protocol/Protocol.ts";
import type { Replication } from "../Replication.ts";

export * as Scripted from "./Scripted.ts";

export type PushAnswer = (
  request: Protocol.PushRequest,
) => Effect.Effect<
  Protocol.PushResponse,
  typeof Protocol.PushError.Type | Replication.Disconnected
>;

export type PullAnswer = (
  request: Protocol.PullRequest,
) => Effect.Effect<
  Protocol.PullResponse,
  typeof Protocol.PullError.Type | Replication.Disconnected
>;

/** A server that answers each call with the next answer of its script and records the requests. */
export const scripted = (script: {
  readonly push?: ReadonlyArray<PushAnswer>;
  readonly pull?: ReadonlyArray<PullAnswer>;
}) => {
  const pushes: Array<Protocol.PushRequest> = [];
  const pulls: Array<Protocol.PullRequest> = [];

  const remote: Replication.Remote = {
    push: (request) =>
      Effect.suspend(() => {
        pushes.push(request);
        const answer = script.push?.[pushes.length - 1];

        return answer === undefined
          ? Effect.die(`No answer for push ${pushes.length}`)
          : answer(request);
      }),
    pull: (request) =>
      Effect.suspend(() => {
        pulls.push(request);
        const answer = script.pull?.[pulls.length - 1];

        return answer === undefined
          ? Effect.die(`No answer for pull ${pulls.length}`)
          : answer(request);
      }),
  };

  return { remote, pushes, pulls };
};

export const ids = (request: Protocol.PushRequest | undefined) =>
  request?.commands.map((command) => command.mutationId);

/** Applies every command it receives. */
export const applyAll: PushAnswer = (request) =>
  Effect.succeed({
    lastMutationId: Math.max(0, ...(ids(request) ?? [])),
    outcomes: request.commands.map((command) =>
      Protocol.Applied.make({ mutationId: command.mutationId }),
    ),
  });

/** Processes nothing yet: the first command waits. */
export const retryFirst: PushAnswer = (request) =>
  Effect.succeed({
    lastMutationId: (request.commands[0]?.mutationId ?? 1) - 1,
    outcomes: [Protocol.Retry.make({ mutationId: request.commands[0]?.mutationId ?? 1 })],
  });

/** Lena's notebook and the school, as the server lists them at these versions. */
export const listed = (notebook = 0, school = 1) => [
  { id: "nb-lena", kind: "notebook", role: "owner", version: notebook, keyEpoch: null },
  { id: "igs", kind: "school", role: "reader", version: school, keyEpoch: null },
];

export const spaces = listed();

export const page =
  (fields: Partial<Protocol.PullResponse> = {}): PullAnswer =>
  () =>
    Effect.succeed({
      syncEpoch: "epoch-1",
      spaces,
      patches: [],
      removed: [],
      lastMutationId: null,
      refusals: [],
      more: false,
      ...fields,
    });

export const readable = (tbl: string, id: string, version: number, data: Schema.Json) => ({
  tbl,
  id,
  version,
  row: Protocol.Readable.make({ data }),
});

export const deleted = (tbl: string, id: string, version: number) => ({
  tbl,
  id,
  version,
  row: Protocol.Deleted.make({}),
});

/** The school offers five courses. */
export const schoolPatch = {
  space: "igs",
  reset: true,
  to: 1,
  ops: [
    readable("Course", "ma", 1, { name: "Mathe" }),
    readable("Course", "de", 1, { name: "Deutsch" }),
    readable("Course", "en", 1, { name: "Englisch" }),
    readable("Course", "fr", 1, { name: "Französisch" }),
    readable("Course", "ku", 1, { name: "Kunst" }),
  ],
};

export const school = page({ patches: [schoolPatch] });
