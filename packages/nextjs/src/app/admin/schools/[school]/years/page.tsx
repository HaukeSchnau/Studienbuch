"use client";

import { z } from "zod";

import { isYearActive } from "@stu/lib";

import { Button } from "~/components/form/Button";
import { Card, CardHeading } from "~/components/layout/Card";
import { Grid } from "~/components/layout/Grid";
import { PageHeading } from "~/components/layout/PageHeading";
import { useParsedParams } from "~/infrastructure/hooks/useSafeParams";
import { api } from "~/infrastructure/trpc/react";

export default function YearsPage() {
  const years = api.schools.years.list.useQuery({});
  const { school } = useParsedParams(
    z.object({
      school: z.string(),
    }),
  );

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
              <Card key={year.startYear} className={!isYearActive(year) && "opacity-60"}>
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
