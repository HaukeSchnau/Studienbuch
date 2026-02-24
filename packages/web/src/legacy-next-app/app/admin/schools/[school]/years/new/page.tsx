"use client";

import { SCHOOL_IDS } from "@stu/lib";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { Card } from "~/components/layout/Card";
import { PageHeading } from "~/components/layout/PageHeading";
import { YearForm } from "~/features/years/YearForm";
import { useParsedParams } from "~/infrastructure/hooks/useSafeParams";
import { api } from "~/infrastructure/trpc/react";

export default function NewYearPage() {
  const router = useRouter();
  const { school } = useParsedParams(z.object({ school: z.enum(SCHOOL_IDS) }));

  const utils = api.useUtils();
  const addYear = api.management.years.add.useMutation({
    onSuccess: () => {
      void utils.schools.years.list.invalidate();
      router.push(`/admin/schools/${school}/years`);
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
