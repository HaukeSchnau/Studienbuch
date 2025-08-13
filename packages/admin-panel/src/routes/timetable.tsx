import { Database, recurringCourses } from "@stu/db";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { Effect } from "effect";
import type { CSSProperties } from "react";
import { z } from "zod";
import { runtime } from "@/runtime";
import { getCurrentYearNum } from "../../../lib/src/years";

export const Route = createFileRoute("/timetable")({
  component: RouteComponent,
  validateSearch: z.object({
    startYear: z.number().optional(),
    classIdentifier: z.string().optional(),
  }),
});

const getCourses = createServerFn()
  .validator(
    z.object({
      startYear: z.number(),
      classIdentifier: z.string(),
    }),
  )
  .handler(({ data: { startYear, classIdentifier } }) =>
    runtime.runPromise(
      recurringCourses.pipe(
        Effect.map((courses) =>
          courses.filter(
            (course) => course.class.startYear === startYear && course.class.identifierInYear === classIdentifier,
          ),
        ),
      ),
    ),
  );

const getClasses = createServerFn().handler(() =>
  runtime.runPromise(
    Effect.gen(function* () {
      const db = yield* Database;
      return yield* db.execute((db) =>
        db.query.Classes.findMany({
          with: {
            year: true,
          },
        }),
      );
    }),
  ),
);

const ClassSelectField = ({
  selectedClass,
  setSelectedClass,
}: {
  selectedClass:
    | {
        startYear: number;
        identifierInYear: string;
      }
    | undefined;
  setSelectedClass: (clazz: { startYear: number; identifierInYear: string }) => void;
}) => {
  const getClassesFn = useServerFn(getClasses);
  const { data: classes } = useSuspenseQuery({
    queryKey: ["classes"],
    queryFn: getClassesFn,
  });

  const buildClassValue = (clazz: { startYear: number; identifierInYear: string }) =>
    `${clazz.startYear}.${clazz.identifierInYear}`;

  return (
    <select
      className="h-fit rounded-md bg-primary p-4 text-white"
      value={selectedClass ? buildClassValue(selectedClass) : undefined}
      onChange={(e) => {
        const clazz = classes.find((c) => buildClassValue(c) === e.target.value);
        if (clazz) {
          setSelectedClass(clazz);
        }
      }}
    >
      {classes.map((clazz) => (
        <option key={buildClassValue(clazz)} value={buildClassValue(clazz)}>
          {getCurrentYearNum(clazz.year)}.{clazz.identifierInYear} ({clazz.year.name})
        </option>
      ))}
    </select>
  );
};

type Timetable = {
  courseName: string;
  weeks: Record<"ODD" | "EVEN", number>;
}[][][]; // [day][time][course]

const Timetable = ({ clazz }: { clazz: { startYear: number; identifierInYear: string } }) => {
  const getCoursesFn = useServerFn(getCourses);
  const {
    data: { timetable, startTimes },
  } = useSuspenseQuery({
    queryKey: ["courses", { startYear: clazz.startYear, classIdentifier: clazz.identifierInYear }],
    queryFn: () => getCoursesFn({ data: { startYear: clazz.startYear, classIdentifier: clazz.identifierInYear } }),
    select: (data) => {
      const uniqueStartTimes = new Set<number>();
      for (const course of data) {
        for (const courseTime of course.courseTimes) {
          uniqueStartTimes.add(courseTime.start);
        }
      }
      const startTimes = Array.from(uniqueStartTimes).sort((a, b) => a - b);
      const startTimesToIndex = new Map<number, number>();
      for (let i = 0; i < startTimes.length; i++) {
        startTimesToIndex.set(startTimes[i], i);
      }

      const timetable: Timetable = [
        [],
        [],
        [],
        [],
        [], // monday to friday
      ];
      for (const course of data) {
        for (const courseTime of course.courseTimes) {
          timetable[courseTime.weekday - 1][startTimesToIndex.get(courseTime.start) ?? 0] ??= [];
          timetable[courseTime.weekday - 1][startTimesToIndex.get(courseTime.start) ?? 0].push({
            courseName: course.name,
            weeks: courseTime.weeks,
          });
        }
      }

      return {
        timetable,
        startTimes,
      };
    },
  });

  return (
    <div
      className="grid grid-cols-5 grid-rows-(--num-rows)"
      style={{ "--num-rows": startTimes.length } as CSSProperties}
    >
      {timetable.map((day, dayIndex) =>
        day.map((time, timeIndex) => (
          <div
            key={`${dayIndex}-${
              // biome-ignore lint/suspicious/noArrayIndexKey: dont care
              timeIndex
            }`}
            className="flex flex-col border"
            style={{
              gridRow: timeIndex + 1,
              gridColumn: dayIndex + 1,
            }}
          >
            {time.map((course, courseIndex) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: dont care
              <div key={courseIndex} className="flex flex-col">
                {course.courseName} {course.weeks.ODD} {course.weeks.EVEN}
              </div>
            ))}
          </div>
        )),
      )}
    </div>
  );
};

function RouteComponent() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { startYear, classIdentifier } = Route.useSearch();

  return (
    <div>
      <ClassSelectField
        selectedClass={
          startYear && classIdentifier
            ? {
                startYear,
                identifierInYear: classIdentifier,
              }
            : undefined
        }
        setSelectedClass={(clazz) => {
          navigate({ search: { startYear: clazz.startYear, classIdentifier: clazz.identifierInYear } });
        }}
      />
      {startYear && classIdentifier !== undefined && (
        <Timetable
          clazz={{
            startYear,
            identifierInYear: classIdentifier,
          }}
        />
      )}
    </div>
  );
}
