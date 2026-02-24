import { SCHOOL_IDS } from "@stu/lib";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { PageHeading } from "~/components/layout/PageHeading";
import { TimetableManager } from "~/features/timetable/TimetableManager";
import { api } from "~/infrastructure/trpc/react";
import { requirePermission } from "~/routes/_guards";

export const Route = createFileRoute("/admin/schools/$school/years/$startYear/schedules")({
  beforeLoad: async () => {
    await requirePermission("EDIT_COURSES");
  },
  component: SchedulesPage,
});

function SchedulesPage() {
  const params = Route.useParams();
  const school = z.enum(SCHOOL_IDS).parse(params.school);
  const startYear = z.coerce.number().parse(params.startYear);
  const { data: selectedYear } = api.schools.years.getOne.useQuery({ school, startYear });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <PageHeading color="white">Stundenpläne</PageHeading>
      </div>
      {selectedYear ? <TimetableManager year={selectedYear} /> : <div>Bitte wähle ein Jahr aus</div>}
    </div>
  );
}
