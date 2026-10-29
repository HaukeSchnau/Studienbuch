/**
 * The device schema of the simulation's domain, as an app declares its own for drizzle-kit. From
 * `packages/sync`, `drizzle-kit generate --dialect sqlite --driver expo --schema
 * ./src/simulation/PlannerDevice.ts --out ./src/simulation/migrations` writes its migrations.
 */
import { DeviceSchema } from "../client/DeviceSchema.ts";
import { Planner } from "./Planner.ts";

export * as PlannerDevice from "./PlannerDevice.ts";

export const {
  sync_meta,
  sync_space,
  sync_outbox,
  sync_settled_command,
  sync_rejected_command,
  base_row,
  pending_row,
  sync_row_view,
  Note,
  Choice,
  Offer,
  Topic,
} = DeviceSchema.make([Planner.Note, Planner.Choice, Planner.Offer, Planner.Topic]);
