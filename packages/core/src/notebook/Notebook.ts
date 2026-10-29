/**
 * Mein Studienbuch: a student's space at one school, which only the student writes. Its encrypted
 * rows leave the device as envelopes and ciphertext, and only the owner's devices hold its keys.
 * The server creates the space when it admits the account to the school.
 */
import { Ids, Sync } from "@stu/sync";
import * as Schema from "effect/Schema";
import { School } from "../school/School.ts";

export * as Notebook from "./Notebook.ts";

export const Space = Sync.spaceKind("notebook", { encryption: "sealed", roles: ["owner"] });

/** The notebook space's id, which the server assigns. */
export const Id = Ids.Id.pipe(Schema.brand("NotebookId"));

export type Id = typeof Id.Type;

/**
 * The notebook's school, under the notebook's id. Only the server writes it, at admission and in
 * the transaction of the first enrollment, so `enrollment.set` can't choose another school's
 * courses.
 */
export const Row = Sync.table("Notebook", {
  class: "readable",
  fields: { schoolId: School.Id },
});

export type Row = Sync.Row<typeof Row>;
