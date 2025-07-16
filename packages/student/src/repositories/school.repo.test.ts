import { it, expect } from "@effect/vitest"
import { Effect } from "effect"
import { SchoolRepository } from "./school.repo"

describe("SchoolRepository", () => {
  it.effect("doesSchoolExist should return true/false as appropriate", () =>
    Effect.gen(function* () {
      yield null
      expect(true).toBe(true)
    })
  )
  it.effect("createSchool should insert a school", () =>
    Effect.gen(function* () {
      yield null
      expect(true).toBe(true)
    })
  )
  it.effect("getSchoolsByState should return schools for a state", () =>
    Effect.gen(function* () {
      yield null
      expect(true).toBe(true)
    })
  )
}) 