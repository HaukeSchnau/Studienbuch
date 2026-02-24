import { SCHOOL_IDS } from "@stu/lib";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";

import { Card } from "~/components/layout/Card";
import { PageHeading } from "~/components/layout/PageHeading";
import { YearForm } from "~/features/years/YearForm";
import { api } from "~/infrastructure/trpc/react";

export const Route = createFileRoute("/admin/schools/$school/years/new")({
  component: NewYearPage,
});

function NewYearPage() {
  const params = Route.useParams();
  const navigate = useNavigate({ from: Route.fullPath });
  const school = z.enum(SCHOOL_IDS).parse(params.school);

  const utils = api.useUtils();
  const addYear = api.management.years.add.useMutation({
    onSuccess: () => {
      void utils.schools.years.list.invalidate();
      void navigate({ to: `/admin/schools/${school}/years` });
    },
  });

  return (
    <div>
      <PageHeading color="white">Neuer Jahrgang</PageHeading>

      <div className="h-4" />

      <Card>
        <YearForm
          onSubmit={({ value }) => {
            addYear.mutate({
              name: value.name,
              startYear: value.startYear,
              graduationYear: value.startYear + value.numberOfYears,
              school,
            });
          }}
          isPending={addYear.isPending}
          error={addYear.error?.message}
        />
      </Card>
    </div>
  );
}
