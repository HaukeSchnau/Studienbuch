/**
 * The device schema for the probe table, as an app declares its own: the file drizzle-kit reads
 * to generate the device's migrations.
 */
import { DeviceSchema } from "../client/DeviceSchema.ts";
import { Probe } from "./Probe.ts";

export * as ProbeDevice from "./ProbeDevice.ts";

export const {
  base_row,
  pending_row,
  sync_row_view,
  Probe: ProbeView,
} = DeviceSchema.make([Probe.table]);
