/**
 * The device schema of the test domain, as an app declares its own for drizzle-kit. From
 * `packages/sync`, `drizzle-kit generate --dialect sqlite --driver expo --schema
 * ./src/client/fixture/NotesDevice.ts --out ./src/client/fixture/migrations` writes its migrations.
 */
import { DeviceSchema } from "../DeviceSchema.ts";
import { Notes } from "./Notes.ts";

export * as NotesDevice from "./NotesDevice.ts";

export const {
  sync_meta,
  sync_space,
  sync_outbox,
  sync_rejected_command,
  base_row,
  pending_row,
  sync_row_view,
  Note,
  Choice,
  Course,
} = DeviceSchema.make([Notes.Note, Notes.Choice, Notes.Course]);
