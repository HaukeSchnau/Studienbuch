import { queryOptions } from "@tanstack/react-query";
import { eq } from "drizzle-orm";

import * as t from "@stu/student/schema";

import { db } from "~/db/client";

export interface Holdiay {
  end: Date;
  name: string;
  start: Date;
  year: number;
}

export const getHolidays = ({
  year,
  userId,
}: {
  year: number;
  userId: string;
}) =>
  queryOptions({
    queryKey: ["holidays", { year }],
    queryFn: async (): Promise<Holdiay[]> => {
      const holidays = await db
        .select({
          end: t.holidays.end,
          name: t.holidays.name,
          start: t.holidays.start,
          year: t.holidays.year,
        })
        .from(t.schools)
        .innerJoin(t.students, eq(t.schools.id, t.students.school))
        .innerJoin(t.holidays, eq(t.holidays.state, t.schools.stateCode))
        .where(eq(t.students.person, userId));

      return holidays;
    },
  });
