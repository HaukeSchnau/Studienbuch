import { SCHOOL_IDS } from "@stu/lib";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { PageHeading } from "~/components/layout/PageHeading";
import { api } from "~/infrastructure/trpc/react";
import { requirePermission } from "~/routes/_guards";
import { ClassList } from "~/legacy-next-app/app/admin/schools/[school]/years/[startYear]/classes/components/ClassList";

export const Route = createFileRoute("/admin/schools/$school/years/$startYear/classes")({
  beforeLoad: async () => {
    await requirePermission("EDIT_CLASSES");
  },
  component: ClassesPage,
});

function ClassesPage() {
  const params = Route.useParams();
  const school = z.enum(SCHOOL_IDS).parse(params.school);
  const startYear = z.coerce.number().parse(params.startYear);
  const { data: selectedYear } = api.schools.years.getOne.useQuery({ school, startYear });

  return (
    <div className="flex flex-col gap-4">
      <PageHeading color="white">Klassen</PageHeading>
      {selectedYear && <ClassList year={selectedYear} />}
    </div>
  );
}
