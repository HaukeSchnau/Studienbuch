import * as Schema from "effect/Schema";
import { NonBlankText } from "../foundation/non-blank-text";
import { DataSourceId, ExternalEntityKind, ExternalId, ImportId } from "./identity";
import { SourceRevision } from "./source-revision";

/** A configured provider feed. Its id distinguishes multiple feeds from the same provider. */
export const DataSource = Schema.Struct({
  id: DataSourceId,
  provider: NonBlankText,
});
export interface DataSource extends Schema.Schema.Type<typeof DataSource> {}

/**
 * Identifies one provider-owned record observation. Revisions are ordered only within the same
 * data source, entity kind, and external identity; observation time is diagnostic rather than
 * authoritative.
 */
export const SourceStamp = Schema.Struct({
  dataSource: DataSource,
  entityKind: ExternalEntityKind,
  externalId: ExternalId,
  importId: ImportId,
  revision: SourceRevision.Schema,
  observedAt: Schema.DateTimeUtcFromString,
});
export interface SourceStamp extends Schema.Schema.Type<typeof SourceStamp> {}

/**
 * One provider record as observed during an import.
 *
 * Deliberately a type and not a schema: reconciliation is in-memory, and every observation is
 * built by the importer from values it already holds. Give it a schema when import state is
 * actually persisted or synced, and derive this type from that schema rather than restating it.
 */
export interface SourceObservation<Value> {
  readonly value: Value;
  readonly rawValue: Schema.Json;
  readonly stamp: SourceStamp;
}
