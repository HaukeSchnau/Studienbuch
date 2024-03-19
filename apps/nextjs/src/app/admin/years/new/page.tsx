"use client";

import { useRouter } from "next/navigation";

import { Card } from "~/components/layout/Card";
import { PageHeading } from "~/components/layout/PageHeading";
import { YearForm } from "~/features/years/YearForm";
import { api } from "~/infrastructure/trpc/react";

export default function NewYearPage() {
  const router = useRouter();

  const utils = api.useUtils();
  const addYear = api.years.add.useMutation({
    onSuccess: () => {
      void utils.years.get.invalidate();
      void utils.years.list.invalidate();
      void utils.years.listGroupedBySchool.invalidate();
      router.push("/admin/years");
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
              schoolId: value.schoolId,
            });
          }}
          isPending={addYear.isPending}
          error={addYear.error?.message}
        />
      </Card>
    </div>
  );
}
