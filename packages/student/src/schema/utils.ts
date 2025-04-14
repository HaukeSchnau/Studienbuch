import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { getTableConfig, int, text } from "drizzle-orm/sqlite-core";

export const uuid = <TName extends string>(name: TName) => text(name);

export const sqliteEnum =
  <U extends string, T extends Readonly<[U, ...U[]]>>(values: T) =>
  <TName extends string>(name: TName) =>
    text(name, { enum: values });

export const boolean = <TName extends string>(name: TName) =>
  int(name, { mode: "boolean" });

export const jsonb = <TName extends string>(name: TName) =>
  text(name, { mode: "json" });

export const timestamp = <TName extends string>(name: TName) =>
  int(name, { mode: "timestamp_ms" });
