"use client";

import type { SchoolId } from "@stu/lib";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { SelectField } from "~/components/form/SelectField";
import { PermissionNavigationItem } from "~/components/layout/nav/PermissionNavigationItem";
import { useSafeParams } from "~/infrastructure/hooks/useSafeParams";
import { api } from "~/infrastructure/trpc/react";

interface Props {
  school: SchoolId;
}

export const YearsNav = ({ school }: Props) => {
  const years = api.schools.years.list.useQuery({ school });
  const router = useRouter();
  const params = useSafeParams(z.object({ startYear: z.coerce.number() }));

  const handleYearChange = (value?: { startYear: number }) => {
    if (value) {
      router.push(`/admin/schools/${school}/years/${value.startYear}`);
    }
  };

  return (
    <>
      {years.data && (
        <SelectField
          options={years.data}
          valueId={params.startYear}
          emptyLabel="Kein Jahrgang ausgewählt"
          onChange={handleYearChange}
          getOptionLabel={(year) => `${year.name} (${year.graduationYear})`}
          getOptionId={(year) => year.startYear}
        />
      )}

      {params.startYear && (
        <>
          <PermissionNavigationItem
            permission="EDIT_CLASSES"
            href={`/admin/schools/${school}/years/${params.startYear}/classes`}
          >
            Klassen
          </PermissionNavigationItem>
          <PermissionNavigationItem
            permission="EDIT_COURSES"
            href={`/admin/schools/${school}/years/${params.startYear}/courses`}
          >
            Kurse
          </PermissionNavigationItem>
          <PermissionNavigationItem
            permission="EDIT_COURSES"
            href={`/admin/schools/${school}/years/${params.startYear}/schedules`}
          >
            Stundenpläne
          </PermissionNavigationItem>
        </>
      )}
    </>
  );
};
