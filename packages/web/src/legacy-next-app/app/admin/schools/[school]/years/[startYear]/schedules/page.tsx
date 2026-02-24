"use client";

import { PageHeading } from "~/components/layout/PageHeading";
import { TimetableManager } from "~/features/timetable/TimetableManager";
import { useSelectedYear } from "../useSelectedYear";

export default function SchedulesPage() {
  const { selectedYear } = useSelectedYear();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <PageHeading color="white">Stundenpläne</PageHeading>
      </div>
      {selectedYear ? <TimetableManager year={selectedYear} /> : <div>Bitte wähle ein Jahr aus</div>}
    </div>
  );
}
