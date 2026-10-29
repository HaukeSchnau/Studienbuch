/**
 * Profil: what the student says about themself in one notebook. It is encrypted, so the display
 * name never reaches the server, and the account's own name stays empty. `notebook.update` writes
 * it from M3; until then only the demo seed does.
 */
import { Sync } from "@stu/sync";
import * as Schema from "effect/Schema";
import { Text } from "../text/Text.ts";

export * as NotebookProfile from "./NotebookProfile.ts";

/** The name the app greets the student with. */
export const DisplayName = Text.NonBlank.check(Schema.isMaxLength(80));

export type DisplayName = typeof DisplayName.Type;

/** One per notebook, under the notebook's id, so two offline devices write the same row. */
export const Row = Sync.table("NotebookProfile", {
  class: "encrypted",
  fields: {
    displayName: Schema.optional(DisplayName),
  },
  writableBy: { notebook: ["owner"] },
});

export type Row = Sync.Row<typeof Row>;
