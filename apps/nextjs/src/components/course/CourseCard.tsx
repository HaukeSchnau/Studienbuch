"use client";

import { z } from "zod";

import type { Course } from "@stu/lib";
import { formalName } from "@stu/lib";

import { useParsedParams } from "~/infrastructure/hooks/useSafeParams";
import { Card, CardHeading } from "../layout/Card";

interface CourseCardProps {
  course: Course;
}

export const CourseCard = ({ course }: CourseCardProps) => {
  const { school, year } = useParsedParams(
    z.object({
      school: z.string(),
      year: z.string(),
    }),
  );

  return (
    <Card
      href={`/admin/schools/${school}/years/${year}/courses/${course.id}`}
      className="flex flex-col"
    >
      <CardHeading>{course.name}</CardHeading>
      <span>{course.name}</span>
    </Card>
  );
};
