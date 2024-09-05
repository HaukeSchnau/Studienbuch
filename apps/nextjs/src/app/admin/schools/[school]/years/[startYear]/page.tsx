"use client";

import { useRouter } from "next/navigation";
import { z } from "zod";

import { SCHOOL_IDS } from "@stu/lib";

import { Card } from "~/components/layout/Card";
import { LoadingIndicator } from "~/components/layout/LoadingIndicator";
import { PageHeading } from "~/components/layout/PageHeading";
import { YearForm } from "~/features/years/YearForm";
import { useParsedParams } from "~/infrastructure/hooks/useSafeParams";
import { api } from "~/infrastructure/trpc/react";

export default function EditYearPage() {
  const params = useParsedParams(
    z.object({ school: z.enum(SCHOOL_IDS), startYear: z.coerce.number() }),
  );
  const {
    data: year,
    isPending,
    isError,
    error,
  } = api.years.getOne.useQuery({
    school: params.school,
    startYear: params.startYear,
  });
  const router = useRouter();

  const updateYear = api.management.years.update.useMutation({
    onSuccess: () => router.push("/admin/users"),
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
