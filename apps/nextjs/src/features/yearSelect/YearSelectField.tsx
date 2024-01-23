"use client";

import { useEffect } from "react";

import { LoadingIndicator } from "~/components/layout/LoadingIndicator";
import { api } from "~/utils/api";
import { SelectField } from "../../components/form/SelectField";
import { useSelectedYear } from "./selectedYearStore";

export const YearSelectField = () => {
  const { data: years, isPending, error } = api.years.get.useQuery();
  const { selectedYear, setSelectedYear } = useSelectedYear();

  useEffect(() => {
    if (years?.[0] && !selectedYear) {
      setSelectedYear(years[0]);
    }
  }, [selectedYear, setSelectedYear, years]);

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <SelectField
      label="Jahrgang"
      emptyLabel="Kein Jahrgang ausgewählt"
      options={years
        .slice()
        .sort((a, b) => a.graduationYear - b.graduationYear)
        .map((year) => ({
          label: `${year.name} (${year.graduationYear})`,
          value: year,
          id: year.name,
        }))}
      valueId={selectedYear?.name}
      onChange={(year) => year && setSelectedYear(year)}
    />
  );
};
