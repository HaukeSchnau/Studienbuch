import * as Order from "effect/Order";
import * as Schema from "effect/Schema";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";
import { PlainDateSchema } from "../foundation/plain-date";
import { EntityLink, SourceIdentity } from "../importing/entity-link";
import { type DataSourceId, ExternalId } from "../importing/identity";
import { CourseOfferingId } from "../organization/identity";
import { BellPeriodId, DatedOccurrenceId, RecurringMeetingId } from "./identity";
import { LocalTimeRange } from "./local-time-range";

const sourceIdentityKey = (source: SourceIdentity) =>
  `${source.dataSourceId}\u0000${source.entityKind}\u0000${source.externalId}`;

export const ProviderOccurrenceResource = Schema.Struct({
  source: Schema.optional(SourceIdentity),
  entityLink: Schema.optional(EntityLink),
  type: Schema.String,
  status: Schema.optional(Schema.String),
  shortName: Schema.String,
  longName: Schema.String,
  displayName: Schema.String,
  displayNameLabel: Schema.optional(Schema.String),
}).check(
  Schema.makeFilter(
    ({ source, entityLink }) =>
      entityLink === undefined ||
      (source !== undefined && sourceIdentityKey(source) === sourceIdentityKey(entityLink.source)),
    { expected: "a resource entity link for its provider source" },
  ),
);
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

/** A source is always retained; an absent link means domain resolution has not succeeded yet. */
export const ProviderOccurrenceAcademicYear = Schema.Struct({
  source: SourceIdentity,
  entityLink: Schema.optional(EntityLink),
}).check(
  Schema.makeFilter(
    ({ source, entityLink }) =>
      entityLink === undefined ||
      (entityLink._tag === "AcademicYear" &&
        sourceIdentityKey(source) === sourceIdentityKey(entityLink.source)),
    { expected: "an academic-year entity link for its provider source" },
  ),
);
export interface ProviderOccurrenceAcademicYear extends Schema.Schema.Type<
  typeof ProviderOccurrenceAcademicYear
> {}

export const ProviderOccurrenceClaim = Schema.Struct({
  source: SourceIdentity,
  academicYear: ProviderOccurrenceAcademicYear,
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

/**
 * A dated occurrence asserted by one or more provider records.
 *
 * Claims stay separate because two resource views can disagree without either view being corrupt.
 * Source identities preserve provider provenance. Server persistence can attach the exact raw
 * record version without making Core depend on storage identifiers.
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
          claim.academicYear.source.dataSourceId === dataSourceId &&
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
