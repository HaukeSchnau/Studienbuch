import { useState } from "react";

import { type Year } from "@acme/db";

import { YearSelectField } from "~/components/SelectField";
import Timetable from "~/components/Timetable";

export default function SchedulesPage() {
  const [selectedYear, setSelectedYear] = useState<Omit<Year, "createdAt">>();
  return (
    <div>
      <h1 className="text-5xl font-semibold text-white ">Stundenpläne</h1>
      <YearSelectField value={selectedYear} onChange={setSelectedYear} />
      {selectedYear && <Timetable yearId={selectedYear.id} />}
    </div>
  );
}
