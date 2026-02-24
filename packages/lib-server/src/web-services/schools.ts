import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import { Schools } from "@stu/db/schema";
import { defaultTheme, SCHOOL_IDS, themeSchema } from "@stu/lib";
import { z } from "zod";

export const schoolIdInputSchema = z.enum(SCHOOL_IDS);

export const setSchoolThemeInputSchema = z.object({
  school: schoolIdInputSchema,
  image: z.string().optional(),
  theme: themeSchema,
});

export type SchoolIdInput = z.infer<typeof schoolIdInputSchema>;
export type SetSchoolThemeInput = z.infer<typeof setSchoolThemeInputSchema>;

export const listSchools = async () => {
  return db.query.Schools.findMany();
};

export const findSchoolTheme = async (schoolId: SchoolIdInput) => {
  const school = await db.query.Schools.findFirst({
    where: eq(Schools.id, schoolId),
    columns: {
      theme: true,
      image: true,
    },
  });

  if (!school) {
    return null;
  }

  const parsedTheme = themeSchema.safeParse(school.theme);

  if (!parsedTheme.success) {
    return {
      theme: defaultTheme,
    };
  }

  return {
    theme: parsedTheme.data,
    image: school.image,
  };
};

export const setSchoolTheme = async (input: SetSchoolThemeInput) => {
  return db
    .update(Schools)
    .set({
      image: input.image,
      theme: input.theme,
    })
    .where(eq(Schools.id, input.school));
};
