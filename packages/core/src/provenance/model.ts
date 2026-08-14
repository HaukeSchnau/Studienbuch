import * as Schema from "effect/Schema";
import { ActorRef } from "../people/model";
import { DataSourceId, ExternalId, ImportId, NonEmptyText, Revision } from "../primitives";

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
  Schema.Struct({
    value,
    rawValue: Schema.Json,
    stamp: SourceStamp,
  });

export interface SourceObservation<Value> {
  readonly value: Value;
  readonly rawValue: Schema.Json;
  readonly stamp: SourceStamp;
}

export const UserOverride = <Value extends Schema.Top>(value: Value) =>
  Schema.Struct({
    value,
    changedBy: ActorRef,
    changedAt: Schema.DateTimeUtcFromString,
  });

export interface UserOverride<Value> {
  readonly value: Value;
  readonly changedBy: ActorRef;
  readonly changedAt: typeof Schema.DateTimeUtcFromString.Type;
}

/**
 * Field-level provenance. An override retains its imported backing value so later imports can be
 * accepted without replacing the effective user-owned value.
 */
export const ProvenancedValue = <Value extends Schema.Top>(value: Value) => {
  const observation = SourceObservation(value);
  return Schema.TaggedUnion({
    Sourced: { source: observation },
    Overridden: {
      source: Schema.optionalKey(observation),
      override: UserOverride(value),
    },
  });
};

export interface SourcedValue<Value> {
  readonly _tag: "Sourced";
  readonly source: SourceObservation<Value>;
}

export interface OverriddenValue<Value> {
  readonly _tag: "Overridden";
  readonly source?: SourceObservation<Value>;
  readonly override: UserOverride<Value>;
}

export type ProvenancedValue<Value> = SourcedValue<Value> | OverriddenValue<Value>;

export const sourcedValue = <Value>(source: SourceObservation<Value>): SourcedValue<Value> => ({
  _tag: "Sourced",
  source,
});

export const effectiveValue = <Value>(value: ProvenancedValue<Value>): Value =>
  value._tag === "Overridden" ? value.override.value : value.source.value;

export const importedObservation = <Value>(
  value: ProvenancedValue<Value>,
): SourceObservation<Value> | undefined => value.source;

export const applyOverride = <Value>(
  current: ProvenancedValue<Value>,
  override: UserOverride<Value>,
): OverriddenValue<Value> =>
  current.source === undefined
    ? { _tag: "Overridden", override }
    : { _tag: "Overridden", source: current.source, override };
