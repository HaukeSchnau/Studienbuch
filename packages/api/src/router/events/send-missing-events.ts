import { eq } from "drizzle-orm";

import { db } from "@stu/db/client";
import * as tables from "@stu/db/schema";
import { studentsOfCourse, studentsOfSchool, studentsOfState, studentsOfYear } from "@stu/lib";

export const getUserTopics = async (userId: string) => {
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
    throw new Error("Student not found");
  }

  return [
    studentsOfYear({
      school: student.school.id,
      startYear: student.year.startYear,
    }),
    studentsOfSchool(student.school.id),
    studentsOfState(student.school.stateCode),
    ...student.courses.map(({ course }) => studentsOfCourse(course)),
  ];
};
