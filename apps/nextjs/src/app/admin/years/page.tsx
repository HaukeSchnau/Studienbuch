"use client";

import { isYearActive } from "@schnau/lib";

import { Button } from "~/components/form/Button";
import { Card, CardHeading } from "~/components/layout/Card";
import { Grid } from "~/components/layout/Grid";
import { PageHeading } from "~/components/layout/PageHeading";
import { api } from "~/infrastructure/trpc/react";

export default function YearsPage() {
  const years = api.years.list.useQuery();

  return (
    <div>
      <div className="flex items-center justify-between">
        <PageHeading color="white">Jahrgänge</PageHeading>
        <Button href="/admin/years/new">Neuer Jahrgang</Button>
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
              <Card
                key={year.id}
                className={!isYearActive(year) && "opacity-60"}
              >
                <CardHeading>{year.name}</CardHeading>

                <div className="pb-4">
                  {year.startYear} bis {year.graduationYear}
                </div>

                <div className="flex justify-end">
                  <Button href={`/admin/years/${year.id}`}>Bearbeiten</Button>
                </div>
              </Card>
            )}
          />
        )}
      </div>
    </div>
  );
}
