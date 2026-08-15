import * as Schema from "effect/Schema";
import { CourseOfferingId, SubjectId } from "../organization/identity";
import { DataSourceId, ExternalId } from "./identity";

/** Provider-scoped identity of one record, independent of any domain entity it maps to. */
export const SourceIdentity = Schema.Struct({
  dataSourceId: DataSourceId,
  externalId: ExternalId,
});
export interface SourceIdentity extends Schema.Schema.Type<typeof SourceIdentity> {}

/**
 * Persistent correspondence between a provider record and an internal domain entity.
 * Multiple providers may link to the same entity, but one provider identity may link to at most
 * one entity of each kind.
 */
export const EntityLink = Schema.TaggedUnion({
  Subject: { source: SourceIdentity, subjectId: SubjectId },
  CourseOffering: { source: SourceIdentity, courseOfferingId: CourseOfferingId },
});
export type EntityLink = typeof EntityLink.Type;

const sourceKey = (link: EntityLink): string =>
  `${link._tag}\u0000${link.source.dataSourceId}\u0000${link.source.externalId}`;

export const EntityLinkSet = Schema.Array(EntityLink).check(
  Schema.makeFilter((links) => new Set(links.map(sourceKey)).size === links.length, {
    expected: "unique provider identity per linked entity kind",
  }),
);
export type EntityLinkSet = typeof EntityLinkSet.Type;
