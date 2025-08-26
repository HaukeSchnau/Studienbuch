import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { convertCurrentYearToStartYear, getCurrentYearNum } from "./year";

describe("year", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("getCurrentYearNum", () => {
    vi.setSystemTime(new Date(2022, 6)); // July 2022
    expect(getCurrentYearNum({ startYear: 2013 })).toBe(13);

    vi.setSystemTime(new Date(2021, 7)); // August 2021
    expect(getCurrentYearNum({ startYear: 2013 })).toBe(13);

    vi.setSystemTime(new Date(2021, 6)); // July 2021
    expect(getCurrentYearNum({ startYear: 2013 })).toBe(12);
  });

  test("convertCurrentYearToStartYear", () => {
    vi.setSystemTime(new Date(2022, 6)); // July 2022
    expect(convertCurrentYearToStartYear(13)).toBe(2013);

    vi.setSystemTime(new Date(2021, 7)); // August 2021
    expect(convertCurrentYearToStartYear(13)).toBe(2013);

    vi.setSystemTime(new Date(2021, 6)); // July 2021
    expect(convertCurrentYearToStartYear(12)).toBe(2013);
  });
});
