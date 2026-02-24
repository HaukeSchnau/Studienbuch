import { SCHOOL_IDS } from "@stu/lib";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { CourseList } from "~/components/course/CourseList";
import { PageHeading } from "~/components/layout/PageHeading";
import { api } from "~/infrastructure/trpc/react";
import { requirePermission } from "~/infrastructure/router/guards";

export const Route = createFileRoute("/admin/schools/$school/years/$startYear/courses")({
  beforeLoad: async () => {
    await requirePermission("EDIT_COURSES");
  },
  component: CoursesPage,
});

function CoursesPage() {
  const params = Route.useParams();
  const school = z.enum(SCHOOL_IDS).parse(params.school);
  const startYear = z.coerce.number().parse(params.startYear);
  const { data: selectedYear } = api.schools.years.getOne.useQuery({ school, startYear });

  return (
    <div className="flex flex-col gap-4">
      <PageHeading color="white">Kurse</PageHeading>
      {selectedYear && <CourseList year={selectedYear} />}
    </div>
  );
}
