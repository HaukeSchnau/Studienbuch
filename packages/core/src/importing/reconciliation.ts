import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Schema from "effect/Schema";
import { Revision } from "../foundation";
import {
  ProvenancedValue,
  UserOverride,
  importedObservation,
  sourcedValue,
} from "./provenanced-value";
import { DataSource, SourceObservation, SourceStamp } from "./source";

export const IncomingReconciliationResult = <Value extends Schema.Top>(value: Value) => {
  const provenanced = ProvenancedValue(value);
  const observation = SourceObservation(value);
  return Schema.TaggedUnion({
    Created: { value: provenanced },
    SourceAttached: { value: provenanced },
    Updated: {
      value: provenanced,
      previousObservation: observation,
      overridePreserved: Schema.Boolean,
      effectiveValueChanged: Schema.Boolean,
    },
    Duplicate: { value: provenanced, observation },
    Stale: { value: provenanced, rejectedObservation: observation },
    Conflict: {
      value: provenanced,
      incoming: observation,
      reason: Schema.Literals(["DifferentSource", "RevisionCollision"]),
    },
  });
};

export type IncomingReconciliationResult<Value> =
  | { readonly _tag: "Created"; readonly value: ProvenancedValue<Value> }
  | { readonly _tag: "SourceAttached"; readonly value: ProvenancedValue<Value> }
  | {
      readonly _tag: "Updated";
      readonly value: ProvenancedValue<Value>;
      readonly previousObservation: SourceObservation<Value>;
      readonly overridePreserved: boolean;
      readonly effectiveValueChanged: boolean;
    }
  | {
      readonly _tag: "Duplicate";
      readonly value: ProvenancedValue<Value>;
      readonly observation: SourceObservation<Value>;
    }
  | {
      readonly _tag: "Stale";
      readonly value: ProvenancedValue<Value>;
      readonly rejectedObservation: SourceObservation<Value>;
    }
  | {
      readonly _tag: "Conflict";
      readonly value: ProvenancedValue<Value>;
      readonly incoming: SourceObservation<Value>;
      readonly reason: "DifferentSource" | "RevisionCollision";
    };

export const FeedCompleteness = Schema.Literals(["Complete", "Partial"]);
export type FeedCompleteness = typeof FeedCompleteness.Type;

export const SourceDeletion = SourceStamp.pipe(
  Schema.fieldsAssign({ completeness: FeedCompleteness }),
);
export interface SourceDeletion extends Schema.Schema.Type<typeof SourceDeletion> {}

export const SourceDeletionResult = <Value extends Schema.Top>(value: Value) => {
  const provenanced = ProvenancedValue(value);
  const observation = SourceObservation(value);
  return Schema.TaggedUnion({
    Deleted: { previous: provenanced },
    OverrideDetached: { value: provenanced, removedObservation: observation },
    Retained: {
      value: provenanced,
      reason: Schema.Literals([
        "PartialFeed",
        "DifferentSource",
        "NoSourcedObservation",
        "DeletionNotNewer",
      ]),
    },
  });
};

export type SourceDeletionResult<Value> =
  | { readonly _tag: "Deleted"; readonly previous: ProvenancedValue<Value> }
  | {
      readonly _tag: "OverrideDetached";
      readonly value: ProvenancedValue<Value>;
      readonly removedObservation: SourceObservation<Value>;
    }
  | {
      readonly _tag: "Retained";
      readonly value: ProvenancedValue<Value>;
      readonly reason:
        | "PartialFeed"
        | "DifferentSource"
        | "NoSourcedObservation"
        | "DeletionNotNewer";
    };

export class OverrideRelinquishmentRefused extends Schema.TaggedError<OverrideRelinquishmentRefused>()(
  "Importing.OverrideRelinquishmentRefused",
  { reason: Schema.Literal("SourceNoLongerAvailable") },
) {}

const sameDataSource = (left: DataSource, right: DataSource) => left.id === right.id;

const sameSourceIdentity = (left: SourceStamp, right: SourceStamp) =>
  sameDataSource(left.dataSource, right.dataSource) && left.externalId === right.externalId;

const jsonEquals = (left: Schema.Json, right: Schema.Json) => Equal.equals(left, right);

const withImportedObservation = <Value>(
  current: ProvenancedValue<Value>,
  source: SourceObservation<Value>,
): ProvenancedValue<Value> =>
  current._tag === "Overridden"
    ? { _tag: "Overridden", source, override: current.override }
    : sourcedValue(source);

/**
 * Reconciles one field observation. Source revision is the sole ordering mechanism; timestamps do
 * not reorder observations. All ordinary import outcomes remain explicit data.
 */
export const reconcileIncoming = <Value>(
  current: ProvenancedValue<Value> | undefined,
  incoming: SourceObservation<Value>,
  equivalent: (left: Value, right: Value) => boolean = Equal.equals,
): IncomingReconciliationResult<Value> => {
  if (current === undefined) return { _tag: "Created", value: sourcedValue(incoming) };

  const previous = importedObservation(current);
  if (previous === undefined) {
    return {
      _tag: "SourceAttached",
      value: withImportedObservation(current, incoming),
    };
  }
  if (!sameSourceIdentity(previous.stamp, incoming.stamp)) {
    return { _tag: "Conflict", value: current, incoming, reason: "DifferentSource" };
  }
  if (incoming.stamp.revision < previous.stamp.revision) {
    return { _tag: "Stale", value: current, rejectedObservation: incoming };
  }
  if (incoming.stamp.revision === previous.stamp.revision) {
    return jsonEquals(previous.rawValue, incoming.rawValue) &&
      equivalent(previous.value, incoming.value)
      ? { _tag: "Duplicate", value: current, observation: incoming }
      : { _tag: "Conflict", value: current, incoming, reason: "RevisionCollision" };
  }

  const next = withImportedObservation(current, incoming);
  return {
    _tag: "Updated",
    value: next,
    previousObservation: previous,
    overridePreserved: current._tag === "Overridden",
    effectiveValueChanged:
      current._tag !== "Overridden" && !equivalent(previous.value, incoming.value),
  };
};

/** A partial feed is never evidence that a previously seen source record was deleted. */
export const reconcileSourceDeletion = <Value>(
  current: ProvenancedValue<Value>,
  deletion: SourceDeletion,
): SourceDeletionResult<Value> => {
  if (deletion.completeness === "Partial") {
    return { _tag: "Retained", value: current, reason: "PartialFeed" };
  }
  const source = importedObservation(current);
  if (source === undefined) {
    return { _tag: "Retained", value: current, reason: "NoSourcedObservation" };
  }
  if (!sameSourceIdentity(source.stamp, deletion)) {
    return { _tag: "Retained", value: current, reason: "DifferentSource" };
  }
  if (deletion.revision <= source.stamp.revision) {
    return { _tag: "Retained", value: current, reason: "DeletionNotNewer" };
  }
  if (current._tag === "Sourced") return { _tag: "Deleted", previous: current };
  return {
    _tag: "OverrideDetached",
    value: { _tag: "Overridden", override: current.override },
    removedObservation: source,
  };
};

export const relinquishOverride = Effect.fn("Importing.relinquishOverride")(function* <Value>(
  current: ProvenancedValue<Value>,
) {
  if (current._tag === "Sourced") return current;
  if (current.source === undefined) {
    return yield* new OverrideRelinquishmentRefused({ reason: "SourceNoLongerAvailable" });
  }
  return sourcedValue(current.source);
});

export declare namespace relinquishOverride {
  export type Error = OverrideRelinquishmentRefused;
}

export const overrideFrom = <Value>(
  value: Value,
  changedBy: UserOverride<Value>["changedBy"],
  changedAt: UserOverride<Value>["changedAt"],
): UserOverride<Value> => ({ value, changedBy, changedAt });

export const nextRevision = (revision: Revision): Revision => Revision.make(revision + 1);
