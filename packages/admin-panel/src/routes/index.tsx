import { and, asc, Database, DatabaseLive, eq, isNotNull, or, PersonRepository, tables } from "@stu/db";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import { format, parse } from "date-fns";
import { de } from "date-fns/locale";
import { Effect, Layer, ManagedRuntime } from "effect";
import { Fragment, useEffect } from "react";
import { z } from "zod";

const cn = (...args: unknown[]) => args.filter(Boolean).join(" ");

export const Route = createFileRoute("/")({
  component: Home,
  validateSearch: z.object({
    teacherId: z.string().optional(),
  }),
});

const runtime = ManagedRuntime.make(Layer.merge(DatabaseLive, PersonRepository.Default));

const allTeachers = PersonRepository.use((repo) => repo.getAllPersons());
const getTeachers = createServerFn().handler(() => runtime.runPromise(allTeachers));

const TeacherSelectField = ({
  selectedTeacherId,
  setSelectedTeacherId,
}: {
  selectedTeacherId: string | undefined;
  setSelectedTeacherId: (id: string | undefined) => void;
}) => {
  const getTeachersFn = useServerFn(getTeachers);
  const { data: teachers } = useSuspenseQuery({
    queryKey: ["teachers"],
    queryFn: () => getTeachersFn(),
  });

  useEffect(() => {
    if (teachers.length > 0 && !selectedTeacherId) {
      setSelectedTeacherId(teachers[0]?.id);
    }
  }, [teachers, selectedTeacherId, setSelectedTeacherId]);

  return (
    <select
      className="h-fit rounded-md bg-primary p-4 text-white"
      value={selectedTeacherId}
      onChange={(e) => setSelectedTeacherId(e.target.value)}
    >
      {teachers.map((teacher) => (
        <option key={teacher.id} value={teacher.id}>
          {teacher.abbrv} ({teacher.firstName} {teacher.lastName})
        </option>
      ))}
    </select>
  );
};

const getTimetableEntries = createServerFn()
  .validator(
    z.object({
      teacherId: z.string(),
    }),
  )
  .handler(async ({ data: { teacherId } }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const db = yield* Database;

        const timetableEntries = yield* db.execute((db) =>
          db
            .select()
            .from(tables.TimetableEntries)
            .innerJoin(tables.Courses, eq(tables.TimetableEntries.course, tables.Courses.id))
            .innerJoin(tables.CoursesToTeachers, eq(tables.CoursesToTeachers.course, tables.Courses.id))
            .leftJoin(
              tables.Substitutions,
              and(
                eq(tables.Substitutions.course, tables.TimetableEntries.course),
                eq(tables.Substitutions.start, tables.TimetableEntries.start),
              ),
            )
            .where(
              or(
                eq(tables.CoursesToTeachers.teacher, teacherId),
                and(isNotNull(tables.Substitutions.substitute), eq(tables.Substitutions.substitute, teacherId)),
              ),
            )
            .orderBy(asc(tables.TimetableEntries.start)),
        );

        const groupedByDay = new Map<string, typeof timetableEntries>();
        for (const entry of timetableEntries) {
          const day = format(entry.timetable_entries.start, "yyyy-MM-dd");
          if (!groupedByDay.has(day)) {
            groupedByDay.set(day, []);
          }
          groupedByDay.get(day)?.push(entry);
        }

        return [...groupedByDay.entries()];
      }),
    ),
  );

const Timetable = ({ teacherId }: { teacherId: string }) => {
  const getTimetableEntriesFn = useServerFn(getTimetableEntries);
  const { data: timetableEntries } = useSuspenseQuery({
    queryKey: ["timetableEntries", teacherId],
    queryFn: () => getTimetableEntriesFn({ data: { teacherId } }),
  });

  const minDate = parse(timetableEntries[0]?.[0] ?? "", "yyyy-MM-dd", new Date());
  const maxDate = parse(timetableEntries.at(-1)?.[0] ?? "", "yyyy-MM-dd", new Date());

  const numDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));

  const START_OF_DAY_IN_MINUTES = 8 * 60;
  const END_OF_DAY_IN_MINUTES = 17 * 60;

  const timeTickWidth = 60;
  const timeTicks = Array.from(
    {
      length: Math.floor((END_OF_DAY_IN_MINUTES - START_OF_DAY_IN_MINUTES) / timeTickWidth),
    },
    (_, index) => {
      const minutes = START_OF_DAY_IN_MINUTES + index * timeTickWidth;
      const leftPercent = (minutes - START_OF_DAY_IN_MINUTES) / (END_OF_DAY_IN_MINUTES - START_OF_DAY_IN_MINUTES);
      return (
        <div
          key={minutes}
          className={cn("absolute top-0 left-0 h-full w-full opacity-30")}
          style={{
            left: `${leftPercent * 100}%`,
          }}
        >
          {format(new Date(0, 0, 0, 0, minutes), "HH:mm")}
        </div>
      );
    },
  );

  return (
    <div
      className="grid gap-x-2"
      style={{
        gridTemplateColumns: "auto auto 1fr",
      }}
    >
      {Array.from({ length: numDays }).map((_, index) => {
        const day = new Date(minDate);
        day.setDate(day.getDate() + index);
        const key = format(day, "yyyy-MM-dd");

        return (
          <Fragment key={key}>
            <div className="border-b">{format(day, "dd.MM.yyyy", { locale: de })}</div>
            <div className="border-b">{format(day, "EEE", { locale: de })}</div>
            <div className="relative w-full border-b">
              {timeTicks}
              {timetableEntries
                .find(([day]) => day === key)?.[1]
                .map((entry) => {
                  const start = entry.timetable_entries.start;
                  const duration = entry.timetable_entries.duration;

                  const startInMinutes = start.getHours() * 60 + start.getMinutes();
                  const endInMinutes = startInMinutes + duration;

                  const startInPercent =
                    (startInMinutes - START_OF_DAY_IN_MINUTES) / (END_OF_DAY_IN_MINUTES - START_OF_DAY_IN_MINUTES);
                  const endInPercent =
                    (endInMinutes - START_OF_DAY_IN_MINUTES) / (END_OF_DAY_IN_MINUTES - START_OF_DAY_IN_MINUTES);

                  return (
                    <div
                      key={`${entry.timetable_entries.start.getTime()}-${entry.courses.id}`}
                      className={cn(
                        "relative top-0 left-0 rounded-md text-white",
                        entry.substitutions ? "bg-yellow-300" : "bg-primary",
                      )}
                      style={{
                        left: `${startInPercent * 100}%`,
                        width: `${(endInPercent - startInPercent) * 100}%`,
                      }}
                    >
                      {entry.courses.name}
                    </div>
                  );
                })}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
};

function Home() {
  const { teacherId } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const setSelectedTeacherId = (teacherId: string | undefined) => {
    navigate({
      search: { teacherId },
    });
  };

  return (
    <div className="flex flex-row gap-4 p-4">
      <TeacherSelectField selectedTeacherId={teacherId} setSelectedTeacherId={setSelectedTeacherId} />

      <div className="flex-1">
        {teacherId ? (
          <Timetable teacherId={teacherId} />
        ) : (
          <div className="grid h-full place-items-center">Bitte wählen Sie einen Lehrer</div>
        )}
      </div>
    </div>
  );
}
