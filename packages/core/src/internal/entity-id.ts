import * as Schema from "effect/Schema";

/** Package-internal schema builder; domain modules retain ownership of every named identifier. */
export const entityId = <const Name extends string>(name: Name) =>
  Schema.String.check(Schema.isTrimmed(), Schema.isNonEmpty()).pipe(Schema.brand(name));
