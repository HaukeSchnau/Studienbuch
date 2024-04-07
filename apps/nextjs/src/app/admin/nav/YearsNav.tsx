"use client";

import { useRouter } from "next/navigation";
import { z } from "zod";

import { SelectField } from "~/components/form/SelectField";
import { PermissionNavigationItem } from "~/components/layout/nav/PermissionNavigationItem";
import { useSafeParams } from "~/infrastructure/hooks/useSafeParams";
import { api } from "~/infrastructure/trpc/react";

interface Props {
  schoolId: number;
}

export const YearsNav = ({ schoolId }: Props) => {
  const years = api.years.list.useQuery({ school: schoolId });
  const router = useRouter();
  const params = useSafeParams(z.object({ year: z.coerce.number() }));

  const handleYearChange = (value?: { id: number }) => {
    if (value) {
      router.push(`/admin/schools/${schoolId}/years/${value.id}`);
    }
  };

  return (
    <>
      {years.data && (
        <SelectField
          options={years.data}
          valueId={params.year}
          emptyLabel="Kein Jahrgang ausgewählt"
          onChange={handleYearChange}
          getOptionLabel={(year) => `${year.name} (${year.graduationYear})`}
          getOptionId={(year) => year.id}
        />
      )}

      {params.year && (
        <>
          <PermissionNavigationItem
            permission="EDIT_CLASSES"
            href={`/admin/schools/${schoolId}/years/${params.year}/classes`}
          >
            Klassen
          </PermissionNavigationItem>
          <PermissionNavigationItem
            permission="EDIT_COURSES"
            href={`/admin/schools/${schoolId}/years/${params.year}/courses`}
          >
            Kurse
          </PermissionNavigationItem>
          <PermissionNavigationItem
            permission="EDIT_COURSES"
            href={`/admin/schools/${schoolId}/years/${params.year}/schedules`}
          >
            Stundenpläne
          </PermissionNavigationItem>
        </>
      )}
    </>
  );
};
