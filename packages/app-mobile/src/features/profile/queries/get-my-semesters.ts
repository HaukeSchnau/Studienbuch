import { RequiredEntityNotFoundError, SemesterRepository, StudentRepository, YearRepository } from "@stu/lib";
import { queryOptions } from "@tanstack/react-query";
import { Effect } from "effect";
import type { AppRuntime } from "~/utils/groundswell";

const semestersOfStudent = Effect.fn(function* ({ userId }: { userId: string }) {
  const studentRepo = yield* StudentRepository;
  const student = yield* studentRepo.getStudent({ studentId: userId });

  if (!student) return yield* Effect.fail(new RequiredEntityNotFoundError({ kind: "student", id: userId }));
  const yearId = {
    startYear: student.class.startYear,
    school: student.school,
  };

  const yearRepo = yield* YearRepository;
  const year = yield* yearRepo.getYear(yearId);
  if (!year) return yield* Effect.fail(new RequiredEntityNotFoundError({ kind: "year", id: yearId }));

  const semesterRepo = yield* SemesterRepository;
  const semesters = yield* semesterRepo.semestersInYear(year);
  return semesters.sort();
});

// TODO: gotta solve this using the semester repo and based on the user's year
export const getMySemesters = (runtime: AppRuntime, { userId }: { userId: string }) =>
  queryOptions({
    queryKey: ["my-semesters", userId],
    queryFn: () => runtime.runPromise(semestersOfStudent({ userId })),
  });
