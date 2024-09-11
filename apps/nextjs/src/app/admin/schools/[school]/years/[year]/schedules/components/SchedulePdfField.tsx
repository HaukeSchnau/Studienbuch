import type { ChangeEvent } from "react";
import { useMemo } from "react";

import type { Course, ProtoCourseWithTimes, Timetable } from "@stu/lib";
import { buildTimetable } from "@stu/lib";

import { LoadingIndicator } from "~/components/layout/LoadingIndicator";
import { TimetableView } from "~/features/timetable/TimetableView";
import { useScheduleImportMutation } from "../queries";

interface PdfFieldProps {
  protoCourses: ProtoCourseWithTimes[];
  onChange: (protoCourses: ProtoCourseWithTimes[]) => void;
}

export const SchedulePdfField = ({ protoCourses, onChange }: PdfFieldProps) => {
  const {
    mutateAsync: importSchedule,
    isPending,
    isError,
    error,
  } = useScheduleImportMutation();

  const onFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const protoCourses = await importSchedule({ file });
      onChange(protoCourses);
    } else {
      onChange([]);
    }
  };

  // const timetable = useMemo<Timetable | undefined>(() => {
  //   const courses: Course[] = protoCourses.map((protoCourse) => ({
  //     ...protoCourse,
  //     id: performance.now(),
  //     courseId: protoCourse.normalizedCourseId,
  //     name: protoCourse.guessedSubject,
  //     teacher: {
  //       id: performance.now(),
  //       name: protoCourse.teacher,
  //       title: "",
  //     },
  //   }));

  //   return buildTimetable(courses);
  // }, [protoCourses]);

  // return (
  //   <>
  //     <input
  //       type="file"
  //       accept=".pdf"
  //       onChange={onFileChange}
  //       disabled={isPending}
  //     />
  //     {isPending ? (
  //       <LoadingIndicator />
  //     ) : isError ? (
  //       <p>{error.message}</p>
  //     ) : timetable ? (
  //       <TimetableView timetable={timetable} />
  //     ) : null}
  //   </>
  // );

  return <></>;
};
