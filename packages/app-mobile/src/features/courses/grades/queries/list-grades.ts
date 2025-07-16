import * as t from "@stu/student/schema";
import { queryOptions } from "@tanstack/react-query";
import { desc, eq } from "drizzle-orm";

import { db } from "~/db/client";

export const listGrades = ({ courseId }: { courseId: string }) =>
  queryOptions({
    queryKey: ["grades", { courseId }],
    queryFn: async () => {
      return db.select().from(t.grades).where(eq(t.grades.course, courseId)).orderBy(desc(t.grades.date));
    },
  });
