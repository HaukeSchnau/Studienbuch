import { useState } from "react";

import { type Year } from "@acme/db";

import { PageHeading } from "~/components/PageHeading";
import { YearSelectField } from "~/components/SelectField";
import Timetable from "~/components/Timetable";

export default function SchedulesPage() {
  const [selectedYear, setSelectedYear] = useState<Omit<Year, "createdAt">>();
  return (
    <div className="flex flex-col gap-4">
      <PageHeading title="Stundenpläne" />
      <YearSelectField value={selectedYear} onChange={setSelectedYear} />
      {selectedYear && <Timetable yearId={selectedYear.id} />}
    </div>
  );
}
