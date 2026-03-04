import { PERMISSIONS } from "@stu/db/schema";
import { SALUTATIONS } from "@stu/lib";
import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";

import { permissionProcedure } from "../../../procedures";

const editUsersProcedure = permissionProcedure("EDIT_USERS");
const webServicesModuleUrl = new URL("../../../../../lib-server/src/web-services.ts", import.meta.url).href;

const scopeOptions = ["schools", "years", "classes", "courses"] as const;

const updateManyUsersInputSchema = z.array(
  z.object({
    id: z.string().uuid(),
    email: z.string().nullable().optional(),
    passwordHash: z.string().nullable().optional(),
    isSuperUser: z.boolean().optional(),
    notificationTokens: z.array(z.string()).optional(),
  }),
);
const addUserInputSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().optional(),
  password: z.string().optional(),
  salutation: z.enum(SALUTATIONS).optional(),
  abbrv: z.string().optional(),
});
const updateUserPasswordInputSchema = z.object({
  id: z.string(),
  password: z.string(),
});
const deleteUserInputSchema = z.string();
const listUserScopeOptionsInputSchema = z.enum(scopeOptions);
const setUserPermissionsInputSchema = z.object({
  userId: z.string(),
  isSuperUser: z.boolean(),
  permissions: z.array(
    z.object({
      permission: z.enum(PERMISSIONS),
      scope: z.record(z.array(z.number())).nullable(),
    }),
  ),
});

type UpdateManyUsersInput = z.infer<typeof updateManyUsersInputSchema>;
type AddUserInput = z.infer<typeof addUserInputSchema>;
type UpdateUserPasswordInput = z.infer<typeof updateUserPasswordInputSchema>;
type ListUserScopeOptionsInput = z.infer<typeof listUserScopeOptionsInputSchema>;
type SetUserPermissionsInput = z.infer<typeof setUserPermissionsInputSchema>;

const loadUsersServices = async () => {
  return (await import(webServicesModuleUrl)) as {
    listUsers: () => Promise<unknown>;
    updateManyUsers: (input: UpdateManyUsersInput) => Promise<void>;
    addUser: (input: AddUserInput) => Promise<unknown>;
    updateUserPassword: (input: UpdateUserPasswordInput) => Promise<void>;
    deleteUser: (userId: string) => Promise<void>;
    listUserScopeOptions: (input: ListUserScopeOptionsInput) => Promise<unknown>;
    setUserPermissions: (input: SetUserPermissionsInput) => Promise<void>;
  };
};

export const users = {
  list: editUsersProcedure.query(async () => (await loadUsersServices()).listUsers()),

  updateMany: editUsersProcedure.input(updateManyUsersInputSchema).mutation(async ({ input }) => {
    await (await loadUsersServices()).updateManyUsers(input);
  }),

  add: editUsersProcedure
    .input(addUserInputSchema)
    .mutation(async ({ input }) => (await loadUsersServices()).addUser(input)),

  updatePassword: editUsersProcedure.input(updateUserPasswordInputSchema).mutation(async ({ input }) => {
    await (await loadUsersServices()).updateUserPassword(input);
  }),

  delete: editUsersProcedure.input(deleteUserInputSchema).mutation(async ({ input }) => {
    await (await loadUsersServices()).deleteUser(input);
  }),

  listScopeOptions: editUsersProcedure
    .input(listUserScopeOptionsInputSchema)
    .query(async ({ input }) => (await loadUsersServices()).listUserScopeOptions(input)),

  setPermissions: editUsersProcedure.input(setUserPermissionsInputSchema).mutation(async ({ input }) => {
    await (await loadUsersServices()).setUserPermissions(input);
  }),
} satisfies TRPCRouterRecord;
