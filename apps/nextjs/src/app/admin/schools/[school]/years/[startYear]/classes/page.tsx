"use client";

import { PageHeading } from "~/components/layout/PageHeading";
import { useSelectedYear } from "../useSelectedYear";
import { ClassList } from "./components/ClassList";

export default function ClassesPage() {
  const { selectedYear } = useSelectedYear();

  return (
    <div className="flex flex-col gap-4">
      <PageHeading color="white">Klassen</PageHeading>
      {selectedYear && <ClassList year={selectedYear} />}
    </div>
  );
}
