"use client";

import { SelectField } from "~/components/form/SelectField";
import { LoadingIndicator } from "~/components/layout/LoadingIndicator";
import { api } from "~/infrastructure/trpc/react";
import { useSelectedYear } from "./selectedYearStore";

export const YearSelectField = () => {
  const { data: years, isPending, error } = api.years.get.useQuery();
  const { selectedYear, setSelectedYear } = useSelectedYear();

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <SelectField
      label="Jahrgang"
      emptyLabel="Alle Jahrgänge"
      allowEmpty
      options={years
        .slice()
        .sort((a, b) => a.graduationYear - b.graduationYear)}
      valueId={selectedYear?.name}
      onChange={(year) => setSelectedYear(year)}
      getOptionLabel={(year) => `${year.name} (${year.graduationYear})`}
      getOptionId={(year) => year.name}
    />
  );
};
