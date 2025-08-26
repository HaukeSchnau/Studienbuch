import { DateTime, Effect } from "effect";
import type { SimpleDate } from "./dates";
import { SemesterRepository } from "./repositories";
import type { SchoolId } from "./schools";

export interface Semester {
  name: string;
  start: SimpleDate;
  end: SimpleDate;
  type: Semester.Type;
  year: number;
  school: SchoolId;
}

export namespace Semester {
  export const current = Effect.gen(function* () {
    // TODO: Don't hardcode school id
    const school = "igs-lil";
    const today = yield* DateTime.now.pipe(Effect.andThen(DateTime.toDate));
    const repo = yield* SemesterRepository;

    const semester = yield* repo.getSemesterOnDate(today, school);
    if (semester) return semester;

    const nextSemester = yield* repo.getNextSemesterAfterDate(today, school);
    if (nextSemester) return nextSemester;

    return yield* repo.getLatestSemester(school);
  });

  export type Type = "SUMMER" | "WINTER";
  export interface Id {
    type: Semester.Type;
    year: number;
  }
}
