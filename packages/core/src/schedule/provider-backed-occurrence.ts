import * as Order from "effect/Order";
import * as Schema from "effect/Schema";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";
import { PlainDateSchema } from "../foundation/plain-date";
import { SourceIdentity } from "../importing/entity-link";
import { type DataSourceId, ExternalId } from "../importing/identity";
import { CourseOfferingId } from "../organization/identity";
import { BellPeriodId, DatedOccurrenceId, RecurringMeetingId } from "./identity";
import { LocalTimeRange } from "./local-time-range";

export const ProviderOccurrenceResource = Schema.Struct({
  source: Schema.optional(SourceIdentity),
  type: Schema.String,
  status: Schema.optional(Schema.String),
  shortName: Schema.String,
  longName: Schema.String,
  displayName: Schema.String,
  displayNameLabel: Schema.optional(Schema.String),
});
export interface ProviderOccurrenceResource extends Schema.Schema.Type<
  typeof ProviderOccurrenceResource
> {}

const position = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 4 }));

/**
 * One provider resource position. `Empty` is deliberate: a decoded provider position with neither
 * side still remains visible to diagnostics instead of disappearing during projection.
 */
export const ProviderOccurrenceResourcePosition = Schema.TaggedUnion({
  Current: { position, current: ProviderOccurrenceResource },
  Removed: { position, removed: ProviderOccurrenceResource },
  Replaced: {
    position,
    current: ProviderOccurrenceResource,
    removed: ProviderOccurrenceResource,
  },
  Empty: { position },
});
export type ProviderOccurrenceResourcePosition = typeof ProviderOccurrenceResourcePosition.Type;

export const ProviderOccurrenceText = Schema.Struct({
  type: Schema.String,
  text: Schema.String,
});
export interface ProviderOccurrenceText extends Schema.Schema.Type<typeof ProviderOccurrenceText> {}

export const ProviderOccurrenceClaim = Schema.Struct({
  source: SourceIdentity,
  academicYear: SourceIdentity,
  viewedResource: ProviderOccurrenceResource,
  dayStatus: Schema.String,
  location: Schema.Literals(["Day", "Grid", "Back"]),
  timeRange: LocalTimeRange.Schema,
  type: Schema.String,
  status: Schema.String,
  resources: Schema.Array(ProviderOccurrenceResourcePosition),
  notes: Schema.String,
  icons: Schema.Array(Schema.String),
  texts: Schema.Array(ProviderOccurrenceText),
  lessonText: Schema.String,
  lessonInfo: Schema.optional(Schema.String),
  substitutionText: Schema.String,
  presentation: Schema.Struct({
    color: Schema.String,
    layoutStartPosition: Schema.Int,
    layoutWidth: Schema.Int,
    layoutGroup: Schema.Int,
  }),
});
export interface ProviderOccurrenceClaim extends Schema.Schema.Type<
  typeof ProviderOccurrenceClaim
> {}

const sourceIdentityKey = (source: SourceIdentity) =>
  `${source.dataSourceId}\u0000${source.entityKind}\u0000${source.externalId}`;

/**
 * A dated occurrence asserted by one or more provider records.
 *
 * Claims stay separate because two resource views can disagree without either view being corrupt.
 * The source identities keep every claim connected to its immutable raw record. Domain links can
 * be added later without rewriting provider facts.
 */
export const ProviderBackedOccurrence = Schema.Struct({
  id: DatedOccurrenceId,
  dataSourceId: SourceIdentity.fields.dataSourceId,
  date: PlainDateSchema,
  providerEntryIds: Schema.NonEmptyArray(ExternalId),
  recurringMeetingId: Schema.optional(RecurringMeetingId),
  courseOfferingIds: Schema.Array(CourseOfferingId),
  bellPeriodId: Schema.optional(BellPeriodId),
  claims: Schema.NonEmptyArray(ProviderOccurrenceClaim),
}).check(
  Schema.makeFilter(
    ({ providerEntryIds }) => new Set(providerEntryIds).size === providerEntryIds.length,
    { expected: "unique provider entry identities" },
  ),
  Schema.makeFilter(
    ({ claims }) =>
      new Set(claims.map((claim) => sourceIdentityKey(claim.source))).size === claims.length,
    { expected: "unique provider source claims" },
  ),
  Schema.makeFilter(
    ({ courseOfferingIds }) => new Set(courseOfferingIds).size === courseOfferingIds.length,
    { expected: "unique linked course offerings" },
  ),
  Schema.makeFilter(
    ({ claims, dataSourceId }) =>
      claims.every(
        (claim) =>
          claim.source.dataSourceId === dataSourceId &&
          claim.academicYear.dataSourceId === dataSourceId &&
          claim.viewedResource.source?.dataSourceId === dataSourceId,
      ),
    { expected: "provider claims from the occurrence data source" },
  ),
);
export interface ProviderBackedOccurrence extends Schema.Schema.Type<
  typeof ProviderBackedOccurrence
> {}

/** Derives one stable id without depending on provider response or class-view ordering. */
export const providerBackedOccurrenceId = (input: {
  readonly dataSourceId: DataSourceId;
  readonly date: PlainDate.Record;
  readonly providerEntryIds: ReadonlyArray<ExternalId>;
}): DatedOccurrenceId =>
  DatedOccurrenceId.make(
    JSON.stringify([
      input.dataSourceId,
      PlainDate.toString(input.date),
      [...input.providerEntryIds].sort(Order.String),
    ]),
  );
