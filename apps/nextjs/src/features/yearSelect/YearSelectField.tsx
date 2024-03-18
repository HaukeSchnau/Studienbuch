"use client";

import type { School, Year } from "@schnau/lib";

import { SelectField } from "~/components/form/SelectField";
import { LoadingIndicator } from "~/components/layout/LoadingIndicator";
import { api } from "~/infrastructure/trpc/react";
import { useSelectedYear } from "./selectedYearStore";

export const YearSelectField = () => {
  const {
    data: schools,
    isPending,
    error,
  } = api.years.listGroupedBySchool.useQuery();
  const { selectedYear, setSelectedYear } = useSelectedYear();

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  const groups = new Map<School, Year[]>(
    schools.map(({ years, ...school }) => [school, years]),
  );

  return (
    <SelectField
      label="Jahrgang"
      emptyLabel="Kein Jahrgang ausgewählt"
      groups={groups}
      getGroupId={(school) => school.id}
      getGroupLabel={(school) => school.name}
      valueId={selectedYear?.name}
      onChange={(year) => setSelectedYear(year)}
      getOptionLabel={(year) => `${year.name} (${year.graduationYear})`}
      getOptionId={(year) => year.name}
    />
  );
};
