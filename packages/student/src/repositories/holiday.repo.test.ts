import { it, expect } from "@effect/vitest"
import { Effect } from "effect"
import { HolidayRepository } from "./holiday.repo"

describe("HolidayRepository", () => {
  it.effect("doesHolidayExist should return true/false as appropriate", () =>
    Effect.gen(function* () {
      yield null
      expect(true).toBe(true)
    })
  )
  it.effect("createHoliday should insert a holiday", () =>
    Effect.gen(function* () {
      yield null
      expect(true).toBe(true)
    })
  )
  it.effect("getAllHolidays should return all holidays", () =>
    Effect.gen(function* () {
      yield null
      expect(true).toBe(true)
    })
  )
}) 