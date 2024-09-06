import { int, text } from "drizzle-orm/sqlite-core";
import { v4 as uuidv4 } from "uuid";

export const uuid = <TName extends string>(name: TName) =>
  text(name).$defaultFn(uuidv4);

export const sqliteEnum =
  <TEnum extends readonly [string, ...string[]]>(values: TEnum) =>
  <TName extends string>(name: TName) =>
    text(name, { enum: values });

export const boolean = <TName extends string>(name: TName) =>
  int(name, { mode: "boolean" });

export const jsonb = <TName extends string>(name: TName) =>
  text(name, { mode: "json" });

export const timestamp = <TName extends string>(name: TName) =>
  int(name, { mode: "timestamp" }); 
