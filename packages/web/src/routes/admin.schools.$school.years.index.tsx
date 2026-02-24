import { SCHOOL_IDS } from "@stu/lib";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { Button } from "~/components/form/Button";
import { Card, CardHeading } from "~/components/layout/Card";
import { Grid } from "~/components/layout/Grid";
import { PageHeading } from "~/components/layout/PageHeading";
import { api } from "~/infrastructure/trpc/react";

export const Route = createFileRoute("/admin/schools/$school/years/")({
  component: YearsPage,
});

function YearsPage() {
  const params = Route.useParams();
  const school = z.enum(SCHOOL_IDS).parse(params.school);
  const years = api.schools.years.list.useQuery({ school });

  return (
    <div>
      <div className="flex items-center justify-between">
        <PageHeading color="white">Jahrgänge</PageHeading>
        <Button href={`/admin/schools/${school}/years/new`}>Neuer Jahrgang</Button>
      </div>

      <div className="h-4" />

      <div>
        {years.isPending ? (
          <div>Lädt...</div>
        ) : years.error ? (
          <div>Error: {years.error.message}</div>
        ) : (
          <Grid
            data={years.data}
            renderItem={(year) => (
              <Card key={year.startYear}>
                <CardHeading>{year.name}</CardHeading>

                <div className="pb-4">
                  {year.startYear} bis {year.graduationYear}
                </div>

                <div className="flex justify-end">
                  <Button href={`/admin/schools/${school}/years/${year.startYear}`}>Bearbeiten</Button>
                </div>
              </Card>
            )}
          />
        )}
      </div>
    </div>
  );
}
