import { formalName } from "@acme/common/src/domain/teacher";
import type { Course, User } from "@acme/db";

import { Card, CardHeading } from "./Card";

interface CourseCardProps {
  course: Omit<Course, "createdAt" | "updatedAt" | "room"> & { teacher: User };
}

export const CourseCard = ({ course }: CourseCardProps) => {
  return (
    <Card href={`/admin/courses/${course.id}`} className="flex flex-col">
      <CardHeading>{course.name}</CardHeading>
      <span>{course.courseId}</span>
      <div>{formalName(course.teacher)}</div>
    </Card>
  );
};
