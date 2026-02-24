import { SCHOOL_IDS } from "@stu/lib";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";

import { Card } from "~/components/layout/Card";
import { LoadingIndicator } from "~/components/layout/LoadingIndicator";
import { PageHeading } from "~/components/layout/PageHeading";
import { YearForm } from "~/features/years/YearForm";
import { api } from "~/infrastructure/trpc/react";

export const Route = createFileRoute("/admin/schools/$school/years/$startYear/")({
  component: EditYearPage,
});

function EditYearPage() {
  const params = Route.useParams();
  const school = z.enum(SCHOOL_IDS).parse(params.school);
  const startYear = z.coerce.number().parse(params.startYear);

  const {
    data: year,
    isPending,
    isError,
    error,
  } = api.schools.years.getOne.useQuery({
    school,
    startYear,
  });
  const navigate = useNavigate({ from: Route.fullPath });

  const updateYear = api.management.years.update.useMutation({
    onSuccess: () => {
      void navigate({ to: "/admin/users" });
    },
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div>
      <PageHeading color="white">Jahrgang {year.name} bearbeiten</PageHeading>

      <div className="h-4" />

      <Card>
        <YearForm
          defaultYear={year}
          onSubmit={({ value }) => {
            updateYear.mutate({
              name: value.name,
              startYear: value.startYear,
              graduationYear: value.startYear + value.numberOfYears,
              school: value.schoolId,
            });
          }}
          isPending={updateYear.isPending}
          error={updateYear.error?.message}
        />
      </Card>
    </div>
  );
}
