import { PERMISSIONS } from "@stu/db/schema";
import type { Permission } from "@stu/lib";
import {
  addPerson,
  addPersonInputSchema,
  addYear,
  addYearInputSchema,
  addUser,
  addUserInputSchema,
  deletePerson,
  deletePersonInputSchema,
  deleteUser,
  deleteUserInputSchema,
  findSchoolTheme,
  listClassesByYear,
  listClassesByYearInputSchema,
  listPersons,
  listSchools,
  schoolIdInputSchema,
  listUserScopeOptions,
  listUserScopeOptionsInputSchema,
  listUsers,
  listYears,
  listYearsInputSchema,
  setSchoolTheme,
  setSchoolThemeInputSchema,
  setUserPermissions,
  setUserPermissionsInputSchema,
  updateManyPersons,
  updateManyPersonsInputSchema,
  updateUserPassword,
  updateUserPasswordInputSchema,
  updateYear,
  updateYearInputSchema,
  getOneYear,
  yearIdInputSchema,
} from "@stu/lib-server/web-services";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  getCurrentSessionUser,
  hasCurrentUserPermission,
  loginInputSchema,
  loginWithPassword,
  logoutSession,
  requireCurrentSessionUser,
  requireCurrentUserPermission,
} from "./auth";

const addPersonCompatInputSchema = z.union([
  addPersonInputSchema,
  z.object({
    name: z.string().min(1),
    email: z.string().optional(),
    salutation: z.unknown().optional(),
    abbrv: z.string().optional(),
  }),
]);

const splitLegacyName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ") || firstName;
  return { firstName, lastName };
};

export const getSessionFn = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getCurrentSessionUser();
  if (!user) {
    return null;
  }

  return {
    user,
  };
});

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator(loginInputSchema)
  .handler(async ({ data }) => loginWithPassword(data));

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  await logoutSession();
  return { ok: true as const };
});

export const hasPermissionFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ permission: z.enum(PERMISSIONS) }))
  .handler(async ({ data }) => hasCurrentUserPermission(data.permission as Permission));

export const listSchoolsFn = createServerFn({ method: "GET" }).handler(async () => {
  const schools = await listSchools();
  return schools.map((school) => ({
    ...school,
    theme: (school.theme ?? {}) as Record<string, {}>,
  }));
});

export const getSchoolThemeFn = createServerFn({ method: "GET" })
  .inputValidator(schoolIdInputSchema)
  .handler(async ({ data }) => findSchoolTheme(data));

export const setSchoolThemeFn = createServerFn({ method: "POST" })
  .inputValidator(setSchoolThemeInputSchema)
  .handler(async ({ data }) => {
    await requireCurrentSessionUser();
    return setSchoolTheme(data);
  });

export const listYearsFn = createServerFn({ method: "GET" })
  .inputValidator(listYearsInputSchema)
  .handler(async ({ data }) => listYears(data));

export const getOneYearFn = createServerFn({ method: "GET" })
  .inputValidator(yearIdInputSchema)
  .handler(async ({ data }) => getOneYear(data));

export const addYearFn = createServerFn({ method: "POST" })
  .inputValidator(addYearInputSchema)
  .handler(async ({ data }) => {
    await requireCurrentUserPermission("EDIT_YEARS");
    return addYear(data);
  });

export const updateYearFn = createServerFn({ method: "POST" })
  .inputValidator(updateYearInputSchema)
  .handler(async ({ data }) => {
    await requireCurrentUserPermission("EDIT_YEARS");
    return updateYear(data);
  });

export const listClassesByYearFn = createServerFn({ method: "GET" })
  .inputValidator(listClassesByYearInputSchema)
  .handler(async ({ data }) => listClassesByYear(data));

export const listUsersFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireCurrentUserPermission("EDIT_USERS");
  return listUsers();
});

export const addUserFn = createServerFn({ method: "POST" })
  .inputValidator(addUserInputSchema)
  .handler(async ({ data }) => {
    await requireCurrentUserPermission("EDIT_USERS");
    return addUser(data);
  });

export const deleteUserFn = createServerFn({ method: "POST" })
  .inputValidator(deleteUserInputSchema)
  .handler(async ({ data }) => {
    await requireCurrentUserPermission("EDIT_USERS");
    return deleteUser(data);
  });

export const updateUserPasswordFn = createServerFn({ method: "POST" })
  .inputValidator(updateUserPasswordInputSchema)
  .handler(async ({ data }) => {
    await requireCurrentUserPermission("EDIT_USERS");
    return updateUserPassword(data);
  });

export const setUserPermissionsFn = createServerFn({ method: "POST" })
  .inputValidator(setUserPermissionsInputSchema)
  .handler(async ({ data }) => {
    await requireCurrentUserPermission("EDIT_USERS");
    return setUserPermissions(data);
  });

export const listUserScopeOptionsFn = createServerFn({ method: "GET" })
  .inputValidator(listUserScopeOptionsInputSchema)
  .handler(async ({ data }) => {
    await requireCurrentUserPermission("EDIT_USERS");
    return listUserScopeOptions(data);
  });

export const listPersonsFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireCurrentUserPermission("EDIT_USERS");
  const persons = await listPersons();
  return persons.map((person) => ({
    ...person,
    name: `${person.firstName} ${person.lastName}`.trim(),
  }));
});

export const addPersonFn = createServerFn({ method: "POST" })
  .inputValidator(addPersonCompatInputSchema)
  .handler(async ({ data }) => {
    await requireCurrentUserPermission("EDIT_USERS");
    if ("name" in data) {
      const { firstName, lastName } = splitLegacyName(data.name);
      return addPerson({
        firstName,
        lastName,
        email: data.email,
        salutation: data.salutation as z.infer<typeof addPersonInputSchema>["salutation"],
        abbrv: data.abbrv,
      });
    }

    return addPerson(data);
  });

export const deletePersonFn = createServerFn({ method: "POST" })
  .inputValidator(deletePersonInputSchema)
  .handler(async ({ data }) => {
    await requireCurrentUserPermission("EDIT_USERS");
    return deletePerson(data);
  });

export const updateManyPersonsFn = createServerFn({ method: "POST" })
  .inputValidator(updateManyPersonsInputSchema)
  .handler(async ({ data }) => {
    await requireCurrentUserPermission("EDIT_USERS");
    return updateManyPersons(data);
  });
