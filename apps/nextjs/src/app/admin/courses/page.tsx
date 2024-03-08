"use client";

import { CourseList } from "~/components/course/CourseList";
import { PageHeading } from "~/components/layout/PageHeading";
import { useSelectedYear } from "~/features/yearSelect/selectedYearStore";

export default function Courses() {
  const { selectedYear } = useSelectedYear();

  return (
    <div className="flex flex-col gap-4">
      <PageHeading color="white">Kurse</PageHeading>
      {selectedYear && <CourseList yearId={selectedYear.id} />}
    </div>
  );
}
