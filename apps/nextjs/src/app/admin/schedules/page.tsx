"use client";

import { PageHeading } from "~/components/PageHeading";
import Timetable from "~/components/Timetable";
import { useSelectedYear } from "~/features/yearSelect/selectedYearStore";
import { YearSelectField } from "~/features/yearSelect/SelectField";

export default function SchedulesPage() {
  const { selectedYear } = useSelectedYear();

  return (
    <div className="flex flex-col gap-4">
      <PageHeading title="Stundenpläne" />
      <YearSelectField />
      {selectedYear && <Timetable yearId={selectedYear.id} />}
    </div>
  );
}
