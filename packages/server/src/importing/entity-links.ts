import { Importing } from "@stu/core";
import { eq, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { Database } from "../database/client.ts";
import { entityLinks } from "./schema.ts";

type EntityLinkRow = typeof entityLinks.$inferSelect;

export class InvalidStoredEntityLink extends Schema.TaggedError<InvalidStoredEntityLink>()(
  "Importing.InvalidStoredEntityLink",
  {
    dataSourceId: Schema.String,
    entityKind: Schema.String,
    externalId: Schema.String,
    domainEntityKind: Schema.String,
    domainEntityId: Schema.String,
    reason: Schema.String,
  },
) {}

const domainEntityId = (link: Importing.EntityLink): string => {
  switch (link._tag) {
    case "School":
      return link.schoolId;
    case "AcademicYear":
      return link.academicYearId;
    case "AcademicTerm":
      return link.academicTermId;
    case "Department":
      return link.departmentId;
    case "Building":
      return link.buildingId;
    case "Room":
      return link.roomId;
    case "Cohort":
      return link.cohortId;
    case "ClassGroup":
      return link.classGroupId;
    case "Person":
      return link.personId;
    case "SchoolMembership":
      return link.schoolMembershipId;
    case "Subject":
      return link.subjectId;
    case "CourseOffering":
      return link.courseOfferingId;
  }
};

/** Encodes a validated domain link for stores that reconcile links in their own transaction. */
export const entityLinkRow = (link: Importing.EntityLink) => ({
  dataSourceId: link.source.dataSourceId,
  entityKind: link.source.entityKind,
  externalId: link.source.externalId,
  domainEntityKind: link._tag,
  domainEntityId: domainEntityId(link),
});

const rawLinkFromRow = (row: EntityLinkRow) => {
  const source = {
    dataSourceId: row.dataSourceId,
    entityKind: row.entityKind,
    externalId: row.externalId,
  };
  switch (row.domainEntityKind) {
    case "School":
      return { _tag: "School", source, schoolId: row.domainEntityId };
    case "AcademicYear":
      return { _tag: "AcademicYear", source, academicYearId: row.domainEntityId };
    case "AcademicTerm":
      return { _tag: "AcademicTerm", source, academicTermId: row.domainEntityId };
    case "Department":
      return { _tag: "Department", source, departmentId: row.domainEntityId };
    case "Building":
      return { _tag: "Building", source, buildingId: row.domainEntityId };
    case "Room":
      return { _tag: "Room", source, roomId: row.domainEntityId };
    case "Cohort":
      return { _tag: "Cohort", source, cohortId: row.domainEntityId };
    case "ClassGroup":
      return { _tag: "ClassGroup", source, classGroupId: row.domainEntityId };
    case "Person":
      return { _tag: "Person", source, personId: row.domainEntityId };
    case "SchoolMembership":
      return { _tag: "SchoolMembership", source, schoolMembershipId: row.domainEntityId };
    case "Subject":
      return { _tag: "Subject", source, subjectId: row.domainEntityId };
    case "CourseOffering":
      return { _tag: "CourseOffering", source, courseOfferingId: row.domainEntityId };
  }
};

const decodeRow = (row: EntityLinkRow) =>
  Schema.decodeUnknownEffect(Importing.EntityLink)(rawLinkFromRow(row)).pipe(
    Effect.mapError((error) =>
      InvalidStoredEntityLink.make({
        dataSourceId: row.dataSourceId,
        entityKind: row.entityKind,
        externalId: row.externalId,
        domainEntityKind: row.domainEntityKind,
        domainEntityId: row.domainEntityId,
        reason: String(error),
      }),
    ),
  );

export const readForDataSource = Effect.fn("Importing.readEntityLinksForDataSource")(function* (
  dataSourceId: Importing.DataSourceId,
) {
  const database = yield* Database.Service;
  const rows = yield* database.drizzle
    .select()
    .from(entityLinks)
    .where(eq(entityLinks.dataSourceId, dataSourceId));
  return yield* Effect.forEach(rows, decodeRow);
});

export const put = Effect.fn("Importing.putEntityLink")(function* (link: Importing.EntityLink) {
  const database = yield* Database.Service;
  yield* database.drizzle
    .insert(entityLinks)
    .values(entityLinkRow(link))
    .onConflictDoUpdate({
      target: [
        entityLinks.dataSourceId,
        entityLinks.entityKind,
        entityLinks.externalId,
        entityLinks.domainEntityKind,
      ],
      set: { domainEntityId: domainEntityId(link), updatedAt: sql`now()` },
    });
});

export * as EntityLinks from "./entity-links.ts";
