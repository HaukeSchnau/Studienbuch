/* eslint-disable @typescript-eslint/require-await */
import { eq } from "drizzle-orm";

import type { ServerEventApplicators } from "@stu/lib";
import { db } from "@stu/db/client";
import * as tables from "@stu/db/schema";

const courseTopic = (courseId: string) => `courses.${courseId}`;
const yearTopic = (year: { schoolId: string; startYear: number }) =>
  `years.${year.schoolId}.${year.startYear}`;

export const serverApplicators: ServerEventApplicators = {
  "absence.recorded": {},
  "absence.parentApproved": {},
  "absence.teacherApproved": {},
  "absence.discarded": {},

  "grades.currentGradeSet": {},
  "grades.writtenGradeRecorded": {},
  "grades.teacherApproved": {},
  "grades.parentApproved": {},
  "grades.discarded": {},
  "grades.latestRestored": {},

  "org.school.founded": {},
  "org.year.started": {
    topics: async ({ data }) => [
      yearTopic({ schoolId: data.school, startYear: data.startYear }),
    ],
  },
  "org.teacher.joined": {},
  "org.holiday.created": {},

  "org.courses.created": {
    topics: async ({ data }) => [courseTopic(data.id)],
  },

  "org.timetable.entryCreated": {
    topics: async ({ data }) => [courseTopic(data.course)],
  },
  "org.timetable.substituted": {
    topics: async ({ data }) => [courseTopic(data.course)],
  },
  "org.timetable.canceled": {
    topics: async ({ data }) => [courseTopic(data.course)],
  },

  "auth.licenseGenerated": {},
  "auth.licenseActivated": {},

  "student.joined": {},
  "student.courseAssigned": {},
};
