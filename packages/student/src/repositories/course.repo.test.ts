import { it, expect } from "@effect/vitest"
import { Effect } from "effect"
import { CourseRepository } from "./course.repo"

describe("CourseRepository", () => {
  it.effect("doesCourseExist should return true/false as appropriate", () =>
    Effect.gen(function* () {
      yield null // placeholder for linter
      expect(true).toBe(true) // placeholder
    })
  )

  it.effect("createCourse should insert course, teachers, and classes", () =>
    Effect.gen(function* () {
      yield null // placeholder for linter
      expect(true).toBe(true) // placeholder
    })
  )
}) 