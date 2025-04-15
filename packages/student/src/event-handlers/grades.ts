import { and, desc, eq, gt, isNotNull, isNull, or } from "drizzle-orm";

import type { NamespaceEventApplicators } from "@stu/lib";

import * as tables from "../schema";
import type { Extra } from "./types";

export const gradeApplicators: NamespaceEventApplicators<"grades", Extra> = {
  currentGradeSet: {
    verify: () => Promise.resolve(undefined),
    apply: async (event, { db, user }) => {
      await db
        .delete(tables.grades)
        .where(
          and(
            eq(tables.grades.course, event.data.courseId),
            eq(tables.grades.type, event.data.type),
            or(
              isNull(tables.grades.teacherSignature),
              isNull(tables.grades.parentSignature),
            ),
          ),
        );

      const latestGrade = await db.query.grades.findFirst({
        where: and(
          eq(tables.grades.course, event.data.courseId),
          eq(tables.grades.type, event.data.type),
        ),
        orderBy: desc(tables.grades.date),
      });

      if (
        latestGrade &&
        latestGrade.date.getTime() >= event.data.date.getTime()
      ) {
        throw new Error("You cannot enter grades for a date in the past");
      }

      await db.insert(tables.grades).values({
        course: event.data.courseId,
        date: event.data.date,
        result: event.data.result,
        type: event.data.type,
        parentSignature: user.isOfAge ? "NOT_REQUIRED" : null,
      });
    },
  },

  writtenGradeRecorded: {
    verify: () => Promise.resolve(undefined),
    apply: async (event, { db, user }) => {
      await db.insert(tables.grades).values({
        course: event.data.courseId,
        date: event.data.date,
        result: event.data.result,
        type: "WRITTEN",
        parentSignature: user.isOfAge ? "NOT_REQUIRED" : null,
      });
    },
  },

  teacherApproved: {
    verify: () => Promise.resolve(undefined),
    apply: async (event, { db }) => {
      await db
        .update(tables.grades)
        .set({
          teacherSignature: event.data.signature,
        })
        .where(
          and(
            eq(tables.grades.course, event.data.course),
            eq(tables.grades.date, event.data.date),
            eq(tables.grades.type, event.data.type),
          ),
        );
    },
  },

  parentApproved: {
    verify: () => Promise.resolve(undefined),
    apply: async (event, { db }) => {
      await db
        .update(tables.grades)
        .set({
          parentSignature: event.data.signature,
        })
        .where(
          and(
            eq(tables.grades.course, event.data.course),
            eq(tables.grades.date, event.data.date),
            eq(tables.grades.type, event.data.type),
          ),
        );
    },
  },

  latestRestored: {
    verify: () => Promise.resolve(undefined),
    apply: async (event, { db }) => {
      const latestConfirmedGrade = await db.query.grades.findFirst({
        where: and(
          eq(tables.grades.course, event.data.course),
          eq(tables.grades.type, event.data.type),
          isNotNull(tables.grades.teacherSignature),
          isNotNull(tables.grades.parentSignature),
        ),
        orderBy: desc(tables.grades.date),
      });

      if (!latestConfirmedGrade) {
        throw new Error("No grades to restore");
      }

      await db
        .delete(tables.grades)
        .where(
          and(
            eq(tables.grades.course, event.data.course),
            eq(tables.grades.type, event.data.type),
            gt(tables.grades.date, latestConfirmedGrade.date),
          ),
        );
    },
  },

  discarded: {
    verify: () => Promise.resolve(undefined),
    apply: async (event, { db }) => {
      await db
        .delete(tables.grades)
        .where(
          and(
            eq(tables.grades.course, event.data.course),
            eq(tables.grades.type, event.data.type),
            eq(tables.grades.date, event.data.date),
            or(
              isNull(tables.grades.teacherSignature),
              isNull(tables.grades.parentSignature),
            ),
          ),
        );
    },
  },
};
