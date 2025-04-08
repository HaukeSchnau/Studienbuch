import { and, asc, eq, getTableColumns, inArray, isNull } from "drizzle-orm";

import type { Event } from "@stu/lib";
import { db } from "@stu/db/client";
import * as tables from "@stu/db/schema";
import {
  studentsOfCourse,
  studentsOfSchool,
  studentsOfState,
  studentsOfYear,
} from "@stu/lib";

import { publishEvent } from "./ingest";

const getMissingEvents = async (userId: string, topics: string[]) => {
  const events = await db
    .select({
      ...getTableColumns(tables.events),
    })
    .from(tables.events)
    .leftJoin(
      tables.eventsSentToUsers,
      and(
        eq(tables.eventsSentToUsers.event, tables.events.id),
        eq(tables.eventsSentToUsers.user, userId),
      ),
    )
    .innerJoin(
      tables.eventTopics,
      eq(tables.eventTopics.event, tables.events.id),
    )
    .where(
      and(
        isNull(tables.eventsSentToUsers.user),
        inArray(tables.eventTopics.topic, topics),
      ),
    )
    .orderBy(asc(tables.events.timestamp));

  return events as Omit<Event, "errors">[];
};

export const sendMissingEventsToStudent = async (userId: string) => {
  const student = await db.query.Students.findFirst({
    where: eq(tables.Students.person, userId),
    with: {
      school: true,
      class: true,
      year: true,
      courses: true,
    },
  });

  if (!student) {
    console.warn("Student not found");
    return;
  }

  const topics = [
    studentsOfYear({
      school: student.school.id,
      startYear: student.year.startYear,
    }),
    studentsOfSchool(student.school.id),
    studentsOfState(student.school.stateCode),
    ...student.courses.map(({ course }) => studentsOfCourse(course)),
  ];

  const events = await getMissingEvents(userId, topics);
  for (const event of events) {
    await publishEvent(event, userId);
  }
};
