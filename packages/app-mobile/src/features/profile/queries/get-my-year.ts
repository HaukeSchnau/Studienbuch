import { queryOptions } from "@tanstack/react-query";
import { eq } from "drizzle-orm";

import * as t from "@stu/student/schema";

import { db } from "~/db/client";

export const getMyYear = ({ userId }: { userId: string }) =>
  queryOptions({
    queryKey: ["my-years", { userId }],
    queryFn: async () => {
      const student = await db.query.students.findFirst({
        where: eq(t.students.person, userId),
        with: {
          year: true,
          school: true,
        },
      });

      if (!student) {
        throw new Error("Student not found");
      }

      return {
        year: student.year,
        school: student.school,
      };
    },
  });
