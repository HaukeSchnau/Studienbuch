import { and, count, eq } from "drizzle-orm";

import type { NamespaceEventApplicators } from "@stu/lib";
import { isArraySingleElement } from "@stu/lib";

import { db } from "../client";
import * as tables from "../schema";

export const studentApplicators: NamespaceEventApplicators<"student", unknown> =
  {
    joined: {
      verify: async ({ data }, { initiatorUserId }) => {
        if (initiatorUserId !== data.studentId) return "NOT_ALLOWED";

        const rows = await db
          .select({
            count: count(),
          })
          .from(tables.Users)
          .innerJoin(
            tables.LicenseKeys,
            eq(tables.Users.id, tables.LicenseKeys.activatedBy),
          )
          .innerJoin(
            tables.Schools,
            eq(tables.LicenseKeys.school, tables.Schools.id),
          )
          .where(
            and(
              eq(tables.Users.id, data.studentId),
              eq(tables.Schools.id, data.school),
            ),
          );
        if (!isArraySingleElement(rows))
          throw new Error("Unexpected number of rows");
        if (rows[0].count === 0) return "NOT_ALLOWED";

        const cls = await db.query.Classes.findFirst({
          where: and(
            eq(tables.Classes.school, data.school),
            eq(tables.Classes.startYear, data.class.startYear),
            eq(tables.Classes.identifierInYear, data.class.identifier),
          ),
        });
        if (!cls) return "INVALID_CLASS";
      },
      apply: async ({ data }) => {
        const [firstName, ...lastNameParts] = data.name.split(" ");
        const lastName = lastNameParts.join(" ");

        await db
          .insert(tables.Persons)
          .values({
            id: data.studentId,
            firstName: firstName ?? "",
            lastName,
          })
          .onConflictDoUpdate({
            target: [tables.Persons.id],
            set: {
              firstName: firstName ?? "",
              lastName,
            },
          });

        await db
          .insert(tables.Students)
          .values({
            person: data.studentId,
            school: data.school,
            startYear: data.class.startYear,
            classIdentifier: data.class.identifier,
            isOfAge: data.isOfAge,
          })
          .onConflictDoUpdate({
            target: [tables.Students.person],
            set: {
              school: data.school,
              startYear: data.class.startYear,
              classIdentifier: data.class.identifier,
              isOfAge: data.isOfAge,
            },
          });
      },
    },
    courseAssigned: {
      verify: async ({ data }, { initiatorUserId }) => {
        if (initiatorUserId !== data.studentId) return "NOT_ALLOWED";

        const assignment = await db.query.CourseMemberships.findFirst({
          where: and(
            eq(tables.CourseMemberships.student, data.studentId),
            eq(tables.CourseMemberships.course, data.courseId),
          ),
        });
        if (assignment) return "ALREADY_ASSIGNED";
      },
      apply: async ({ data }) => {
        await db.insert(tables.CourseMemberships).values({
          student: data.studentId,
          course: data.courseId,
        });
      },
    },
  };
