/**
 * Profil: what the student says about themself in one notebook. It is encrypted, so the display
 * name never reaches the server, and the account's own name stays empty. The onboarding writes it
 * with `notebookProfile.set`.
 */
import { Sync, Tx } from "@stu/sync";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { Text } from "../text/Text.ts";
import { Notebook } from "./Notebook.ts";

export * as NotebookProfile from "./NotebookProfile.ts";

/** The name the app greets the student with. */
export const DisplayName = Text.NonBlank.check(Schema.isMaxLength(80));

export type DisplayName = typeof DisplayName.Type;

/** One per notebook, under the notebook's id, so two offline devices write the same row. */
export const Row = Sync.table("NotebookProfile", {
  class: "encrypted",
  fields: {
    displayName: Schema.optional(DisplayName),
    /** Volljährig, as the student states it. Absent in a profile written before it was asked. */
    adult: Schema.optional(Schema.Boolean),
  },
  writableBy: { notebook: ["owner"] },
});

export type Row = Sync.Row<typeof Row>;

/** Sets both answers of the onboarding's profile step. Fields a newer app added stay. */
export const set = Sync.mutator("notebookProfile.set", {
  version: 1,
  args: Schema.Struct({
    notebook: Notebook.Id,
    displayName: DisplayName,
    adult: Schema.Boolean,
  }),
  writes: [Row],
  spaces: (args) => [args.notebook],
  run: Effect.fn("NotebookProfile.set")(function* ({ notebook, ...profile }) {
    const tx = yield* Tx.Service;
    const existing = yield* tx.get(Row, notebook, notebook);

    yield* Option.isNone(existing)
      ? tx.insert(Row, notebook, notebook, profile)
      : tx.patch(Row, notebook, notebook, profile);
  }),
});
