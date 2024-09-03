"use client";

import { useState } from "react";

import { Button } from "~/components/form/Button";
import { PageHeading } from "~/components/layout/PageHeading";
import { TimetableManager } from "~/features/timetable/TimetableManager";
import { useSelectedYear } from "../useSelectedYear";

export default function SchedulesPage() {
  const { selectedYear } = useSelectedYear();

  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <PageHeading color="white">Stundenpläne</PageHeading>
        <Button onClick={() => setIsModalOpen(true)}>Importieren</Button>
      </div>
      {selectedYear ? (
        <TimetableManager year={selectedYear} />
      ) : (
        <div>Bitte wähle ein Jahr aus</div>
      )}
    </div>
  );
}
