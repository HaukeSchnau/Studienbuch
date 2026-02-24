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
  .validator(loginInputSchema)
  .handler(async ({ data }) => loginWithPassword(data));

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  await logoutSession();
  return { ok: true as const };
});

export const hasPermissionFn = createServerFn({ method: "POST" })
  .validator(z.object({ permission: z.enum(PERMISSIONS) }))
  .handler(async ({ data }) => hasCurrentUserPermission(data.permission as Permission));

export const listSchoolsFn = createServerFn({ method: "GET" }).handler(async () => listSchools());

export const getSchoolThemeFn = createServerFn({ method: "GET" })
  .validator(z.string())
  .handler(async ({ data }) => findSchoolTheme(data));

export const setSchoolThemeFn = createServerFn({ method: "POST" })
  .validator(setSchoolThemeInputSchema)
  .handler(async ({ data }) => {
    await requireCurrentSessionUser();
    return setSchoolTheme(data);
  });

export const listYearsFn = createServerFn({ method: "GET" })
  .validator(listYearsInputSchema)
  .handler(async ({ data }) => listYears(data));

export const getOneYearFn = createServerFn({ method: "GET" })
  .validator(yearIdInputSchema)
  .handler(async ({ data }) => getOneYear(data));

export const addYearFn = createServerFn({ method: "POST" })
  .validator(addYearInputSchema)
  .handler(async ({ data }) => {
    await requireCurrentUserPermission("EDIT_YEARS");
    return addYear(data);
  });

export const updateYearFn = createServerFn({ method: "POST" })
  .validator(updateYearInputSchema)
  .handler(async ({ data }) => {
    await requireCurrentUserPermission("EDIT_YEARS");
    return updateYear(data);
  });

export const listClassesByYearFn = createServerFn({ method: "GET" })
  .validator(listClassesByYearInputSchema)
  .handler(async ({ data }) => listClassesByYear(data));

export const listUsersFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireCurrentUserPermission("EDIT_USERS");
  return listUsers();
});

export const addUserFn = createServerFn({ method: "POST" })
  .validator(addUserInputSchema)
  .handler(async ({ data }) => {
    await requireCurrentUserPermission("EDIT_USERS");
    return addUser(data);
  });

export const deleteUserFn = createServerFn({ method: "POST" })
  .validator(deleteUserInputSchema)
  .handler(async ({ data }) => {
    await requireCurrentUserPermission("EDIT_USERS");
    return deleteUser(data);
  });

export const updateUserPasswordFn = createServerFn({ method: "POST" })
  .validator(updateUserPasswordInputSchema)
  .handler(async ({ data }) => {
    await requireCurrentUserPermission("EDIT_USERS");
    return updateUserPassword(data);
  });

export const setUserPermissionsFn = createServerFn({ method: "POST" })
  .validator(setUserPermissionsInputSchema)
  .handler(async ({ data }) => {
    await requireCurrentUserPermission("EDIT_USERS");
    return setUserPermissions(data);
  });

export const listUserScopeOptionsFn = createServerFn({ method: "GET" })
  .validator(listUserScopeOptionsInputSchema)
  .handler(async ({ data }) => {
    await requireCurrentUserPermission("EDIT_USERS");
    return listUserScopeOptions(data);
  });

export const listPersonsFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireCurrentUserPermission("EDIT_USERS");
  return listPersons();
});

export const addPersonFn = createServerFn({ method: "POST" })
  .validator(addPersonInputSchema)
  .handler(async ({ data }) => {
    await requireCurrentUserPermission("EDIT_USERS");
    return addPerson(data);
  });

export const deletePersonFn = createServerFn({ method: "POST" })
  .validator(deletePersonInputSchema)
  .handler(async ({ data }) => {
    await requireCurrentUserPermission("EDIT_USERS");
    return deletePerson(data);
  });

export const updateManyPersonsFn = createServerFn({ method: "POST" })
  .validator(updateManyPersonsInputSchema)
  .handler(async ({ data }) => {
    await requireCurrentUserPermission("EDIT_USERS");
    return updateManyPersons(data);
  });
