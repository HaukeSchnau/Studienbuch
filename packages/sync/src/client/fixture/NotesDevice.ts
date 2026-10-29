/**
 * The device schema of the test domain, as an app declares its own for drizzle-kit. From
 * `packages/sync`, `drizzle-kit generate --dialect sqlite --driver expo --schema
 * "./src/client/{EngineTables,fixture/NotesDevice}.ts" --out ./src/client/fixture/migrations`.
 */
import { DeviceSchema } from "../DeviceSchema.ts";
import { Notes } from "./Notes.ts";

export * as NotesDevice from "./NotesDevice.ts";

export const { base_row, pending_row, sync_row_view, Note, Choice, Course } = DeviceSchema.make([
  Notes.Note,
  Notes.Choice,
  Notes.Course,
]);
