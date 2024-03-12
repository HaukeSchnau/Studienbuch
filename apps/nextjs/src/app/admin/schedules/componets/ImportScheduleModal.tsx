import type { ChangeEvent } from "react";
import { useMemo } from "react";

import type { Course } from "@schnau/lib/src/course";
import type { Timetable } from "@schnau/lib/src/timetable";
import { buildTimetable } from "@schnau/lib/src/timetable";

import { Button } from "~/components/form/Button";
import { LoadingIndicator } from "~/components/layout/LoadingIndicator";
import { Modal } from "~/components/layout/Modal";
import { TimetableView } from "~/features/timetable/TimetableView";
import { useScheduleImportMutation } from "../queries";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportScheduleModal = ({ isOpen, onClose }: Props) => {
  const {
    mutate: importSchedule,
    isPending,
    isError,
    error,
    data: protoCourses,
    reset,
  } = useScheduleImportMutation();

  const timetable = useMemo<Timetable | undefined>(() => {
    if (!protoCourses) return undefined;

    const courses: Course[] = protoCourses.map((protoCourse) => ({
      ...protoCourse,
      id: performance.now(),
      courseId: protoCourse.normalizedCourseId,
      name: protoCourse.guessedSubject,
      teacher: {
        id: performance.now(),
        name: protoCourse.teacher,
        title: "",
      },
    }));

    return buildTimetable(courses);
  }, [protoCourses]);

  const onFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importSchedule({ file });
    } else {
      reset();
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div className="flex flex-col gap-4 p-4">
        <h2 className="text-2xl font-bold">Stundenplan importieren</h2>
        <input type="file" accept=".pdf" onChange={onFileChange} />

        {isPending ? (
          <LoadingIndicator />
        ) : isError ? (
          <p>{error?.message}</p>
        ) : timetable ? (
          <TimetableView timetable={timetable} />
        ) : null}

        <div className="flex gap-4 self-end">
          <Button variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            onClick={onClose}
            disabled={isPending || isError || !timetable}
          >
            Importieren
          </Button>
        </div>
      </div>
    </Modal>
  );
};
