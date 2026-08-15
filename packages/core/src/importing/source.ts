import * as Schema from "effect/Schema";
import { DataSourceId, ExternalId, ImportId, NonEmptyText, Revision } from "../foundation";

/** A configured provider feed. Its id distinguishes multiple feeds from the same provider. */
export const DataSource = Schema.Struct({
  id: DataSourceId,
  provider: NonEmptyText,
});
export interface DataSource extends Schema.Schema.Type<typeof DataSource> {}

/**
 * Identifies one provider-owned record observation. Revisions are ordered only within the same
 * data source and external identity; observation time is diagnostic rather than authoritative.
 */
export const SourceStamp = Schema.Struct({
  dataSource: DataSource,
  externalId: ExternalId,
  importId: ImportId,
  revision: Revision,
  observedAt: Schema.DateTimeUtcFromString,
});
export interface SourceStamp extends Schema.Schema.Type<typeof SourceStamp> {}

export const SourceObservation = <Value extends Schema.Top>(value: Value) =>
  Schema.Struct({ value, rawValue: Schema.Json, stamp: SourceStamp });

export interface SourceObservation<Value> {
  readonly value: Value;
  readonly rawValue: Schema.Json;
  readonly stamp: SourceStamp;
}
