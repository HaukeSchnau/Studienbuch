import { test } from "vitest";

import { isHolidayToday } from "@schnau/common/src/holidays";

import { createClient } from "~/testUtils";

test(
  "staticApi",
  async ({ expect }) => {
    const client = createClient();

    const years = await client.years.get.query();
    for (const year of years) {
      const classes = await client.classes.get.query({ yearId: year.id });
      expect(classes).toMatchSnapshot();

      const courses = client.courses.get.query({ yearId: year.id });
      expect(courses).toMatchSnapshot();
    }

    expect(years).toMatchSnapshot();
  },
  { timeout: 10_000 },
);

test("licenses", async ({ expect }) => {
  const client = createClient();

  const validLicense = await client.license.check.query({
    licenseKey: "KJ27-MP16-LS14-JM22",
  });

  expect(validLicense).toBe("VALID");

  const invalidLicense = await client.license.check.query({
    licenseKey: "ABC",
  });

  expect(invalidLicense).toBe("INVALID");
});

test("substitutions", async ({ expect }) => {
  const client = createClient();

  const oldSubstitutions = await client.substitutions.get.query({
    date: new Date("2023-06-01"),
  });

  const oldSubstitutionsWithoutUpdatedProps = oldSubstitutions.map((sub) => ({
    ...sub,
    updatedAt: undefined,
  }));

  expect(oldSubstitutionsWithoutUpdatedProps).toMatchSnapshot();
});

test("substitutionsToday", async ({ expect }) => {
  const isWeekend = [0, 6].includes(new Date().getDay());
  if (isWeekend) {
    console.log("Skipping test because it's weekend");
    return;
  }

  if (await isHolidayToday()) {
    console.log("Skipping test because it's holiday");
    return;
  }

  const client = createClient();

  const currentSubstitutions = await client.substitutions.get.query({});

  expect(currentSubstitutions.length).toBeGreaterThan(0);
});
