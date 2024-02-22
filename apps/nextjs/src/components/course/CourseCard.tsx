import type { Course } from "@schnau/lib/src/course";
import { formalName } from "@schnau/lib/src/teacher";

import { Card, CardHeading } from "../layout/Card";

interface CourseCardProps {
  course: Course;
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
