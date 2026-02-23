import { db } from "@stu/db/client";
import * as tables from "@stu/db/schema";
import { studentsOfCourse, studentsOfSchool, studentsOfState, studentsOfUser, studentsOfYear } from "@stu/lib";
import { eq } from "drizzle-orm";

const SYSTEM_USER = "00000000-0000-0000-0000-000000000000";

export const getUserTopics = async (userId: string) => {
  if (userId === SYSTEM_USER) {
    return [];
  }

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
    console.warn(`User is not a student: ${userId}`);
    return [];
  }

  return [
    studentsOfUser(student.person),
    studentsOfYear({
      school: student.school.id,
      startYear: student.year.startYear,
    }),
    studentsOfSchool(student.school.id),
    studentsOfState(student.school.stateCode),
    ...student.courses.map(({ course }) => studentsOfCourse(course)),
  ];
};
