import { and, eq } from "drizzle-orm";

import type { NamespaceEventApplicators } from "@stu/lib";

import type { Extra } from "./types";
import * as tables from "../schema";

export const studentApplicators: NamespaceEventApplicators<"student", Extra> = {
  joined: {
    verify: async ({ data }, { db, initiatorUserId }) => {
      if (initiatorUserId !== data.studentId) {
        return "NOT_ALLOWED";
      }

      const cls = await db
        .select()
        .from(tables.classes)
        .where(
          and(
            eq(tables.classes.identifierInYear, data.class.identifier),
            eq(tables.classes.startYear, data.class.startYear),
            eq(tables.classes.school, data.school),
          ),
        );

      console.log(data);

      if (cls.length === 0) {
        return "INVALID_CLASS";
      }
    },
    apply: async ({ data }, { db }) => {
      const firstName = data.name.split(" ")[0];
      const lastName = data.name.split(" ").slice(1).join(" ");

      await db
        .insert(tables.persons)
        .values({
          id: data.studentId,
          firstName,
          lastName,
        })
        .onConflictDoUpdate({
          target: [tables.persons.id],
          set: {
            firstName,
            lastName,
          },
        });

      await db
        .insert(tables.students)
        .values({
          person: data.studentId,
          school: data.school,
          startYear: data.class.startYear,
          classIdentifier: data.class.identifier,
          isOfAge: data.isOfAge,
        })
        .onConflictDoUpdate({
          target: [tables.students.person],
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
    verify: async ({ data }, { db }) => {
      const course = await db
        .select()
        .from(tables.courses)
        .where(eq(tables.courses.id, data.courseId));

      if (course.length === 0) {
        return "INVALID_COURSE";
      }
    },
    apply: async ({ data }, { db }) => {
      await db
        .update(tables.courses)
        .set({
          isMember: true,
        })
        .where(eq(tables.courses.id, data.courseId));
    },
  },
};
