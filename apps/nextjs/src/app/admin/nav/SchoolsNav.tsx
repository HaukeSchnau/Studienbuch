"use client";

import { useRouter } from "next/navigation";
import { z } from "zod";

import { SelectField } from "~/components/form/SelectField";
import { NavigationItem } from "~/components/layout/nav/NavigationItem";
import { PermissionNavigationItem } from "~/components/layout/nav/PermissionNavigationItem";
import { useSafeParams } from "~/infrastructure/hooks/useSafeParams";
import { api } from "~/infrastructure/trpc/react";
import { YearsNav } from "./YearsNav";

export const SchoolsNav = () => {
  const schools = api.schools.list.useQuery();
  const router = useRouter();
  const params = useSafeParams(z.object({ school: z.coerce.number() }));

  const handleSchoolChange = (value?: { id: number }) => {
    if (value) {
      router.push(`/admin/schools/${value.id}`);
    }
  };

  return (
    <>
      {schools.data && (
        <SelectField
          options={schools.data}
          valueId={params.school}
          emptyLabel="Keine Schule ausgewählt"
          onChange={handleSchoolChange}
          getOptionLabel={(school) => school.name}
          getOptionId={(school) => school.id}
        />
      )}

      {params.school && (
        <>
          <NavigationItem
            href={`/admin/schools/${params.school}/theme`}
            icon="palette"
          >
            Theme
          </NavigationItem>

          <NavigationItem
            href={`/admin/schools/${params.school}/substitutions`}
          >
            Vertretungspläne
          </NavigationItem>

          <PermissionNavigationItem
            permission="EDIT_YEARS"
            href={`/admin/schools/${params.school}/years`}
            exact
          >
            Jahrgänge
          </PermissionNavigationItem>

          <YearsNav schoolId={params.school} />
        </>
      )}
    </>
  );
};
