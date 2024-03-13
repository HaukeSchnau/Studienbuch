"use client";

import { useRouter } from "next/navigation";
import { z } from "zod";

import { Card } from "~/components/layout/Card";
import { LoadingIndicator } from "~/components/layout/LoadingIndicator";
import { PageHeading } from "~/components/layout/PageHeading";
import { YearForm } from "~/features/years/YearForm";
import { useSafeParams } from "~/infrastructure/hooks/useSafeParams";
import { api } from "~/infrastructure/trpc/react";

export default function EditYearPage() {
  const { yearId } = useSafeParams(z.object({ yearId: z.coerce.number() }));
  const {
    data: year,
    isPending,
    isError,
    error,
  } = api.years.getOne.useQuery(yearId);
  const router = useRouter();

  const updateYear = api.years.update.useMutation({
    onSuccess: () => router.push("/admin/years"),
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
              id: year.id,
              name: value.name,
              startYear: value.startYear,
              graduationYear: value.startYear + value.numberOfYears,
              schoolId: value.schoolId,
            });
          }}
          isPending={updateYear.isPending}
          error={updateYear.error?.message}
        />
      </Card>
    </div>
  );
}
