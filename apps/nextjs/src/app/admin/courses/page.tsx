"use client";

import { CourseList } from "~/components/CourseList";
import { PageHeading } from "~/components/PageHeading";
import { useSelectedYear } from "~/features/yearSelect/selectedYearStore";
import { YearSelectField } from "~/features/yearSelect/SelectField";

export default function Courses() {
  const { selectedYear } = useSelectedYear();

  return (
    <div className="flex flex-col gap-4">
      <PageHeading title="Kurse" />
      <YearSelectField />
      {selectedYear && <CourseList yearId={selectedYear.id} />}
    </div>
  );
}
