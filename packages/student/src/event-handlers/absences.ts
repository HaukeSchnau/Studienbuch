import { and, eq, inArray } from "drizzle-orm";

import type { NamespaceEventApplicators } from "@stu/lib";

import type { Extra } from "./types";
import * as tables from "../schema";

export const absenceApplicators: NamespaceEventApplicators<"absence", Extra> = {
  recorded: {
    verify: () => Promise.resolve(true),
    apply: async (event, { db, user }) => {
      await db.insert(tables.absenceDays).values({
        date: event.data.date,
        reason: event.data.reason,
        parentSignature: user.isOfAge ? "NOT_REQUIRED" : null,
      });
      await db.insert(tables.courseAbsences).values(
        event.data.courseIds.map((courseId) => ({
          date: event.data.date,
          course: courseId,
        })),
      );
    },
  },

  parentApproved: {
    verify: () => Promise.resolve(true),
    apply: async (event, { db }) => {
      await db
        .update(tables.absenceDays)
        .set({
          parentSignature: event.data.signature,
        })
        .where(eq(tables.absenceDays.date, event.data.date));
    },
  },

  teacherApproved: {
    verify: () => Promise.resolve(true),
    apply: async (event, { db }) => {
      await db
        .update(tables.courseAbsences)
        .set({
          teacherSignature: event.data.signature,
        })
        .where(
          and(
            eq(tables.courseAbsences.date, event.data.date),
            eq(tables.courseAbsences.course, event.data.courseId),
          ),
        );
    },
  },

  discarded: {
    verify: () => Promise.resolve(true),
    apply: async (event, { db }) => {
      await db
        .delete(tables.courseAbsences)
        .where(
          and(
            eq(tables.courseAbsences.date, event.data.date),
            inArray(tables.courseAbsences.course, event.data.courseIds),
          ),
        );

      const courseAbsences = await db.query.courseAbsences.findMany({
        where: eq(tables.courseAbsences.date, event.data.date),
      });

      if (courseAbsences.length === 0) {
        await db
          .delete(tables.absenceDays)
          .where(eq(tables.absenceDays.date, event.data.date));
      }
    },
  },
};
