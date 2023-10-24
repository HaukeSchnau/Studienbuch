"use client";

import { useState } from "react";

import type { Year } from "@acme/db";

import { CourseList } from "~/components/CourseList";
import { PageHeading } from "~/components/PageHeading";
import { YearSelectField } from "~/components/SelectField";

export default function Courses() {
  const [selectedYear, setSelectedYear] = useState<Omit<Year, "createdAt">>();

  return (
    <div className="flex flex-col gap-4">
      <PageHeading title="Kurse" />
      <YearSelectField value={selectedYear} onChange={setSelectedYear} />
      {selectedYear && <CourseList yearId={selectedYear.id} />}
    </div>
  );
}
