import { ingestEffect } from "@stu/api";
import type { SchoolId } from "@stu/lib";
import { defaultSchools } from "@stu/lib";
import { Effect } from "effect";

export const addSchool = (school: SchoolId) => {
  const defaultSchoolValue = defaultSchools[school];
  return ingestEffect({
    type: "org.school.founded",
    data: {
      id: school,
      name: defaultSchoolValue.name,
      state: defaultSchoolValue.stateCode,
    },
    timestamp: defaultSchoolValue.founded,
  }).pipe(
    Effect.tap(() => Effect.logInfo(`School "${school}" founded!`)),
    Effect.catchIf(
      (error) => error.reason === "DUPLICATE",
      () => Effect.logInfo(`School "${school}" already founded. Skipping...`),
    ),
  );
};
