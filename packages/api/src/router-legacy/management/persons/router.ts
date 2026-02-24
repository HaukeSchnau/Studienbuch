import { Persons } from "@stu/db/schema";
import { SALUTATIONS } from "@stu/lib";
import type { TRPCRouterRecord } from "@trpc/server";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { permissionProcedure } from "../../../procedures";

const editUsersProcedure = permissionProcedure("EDIT_USERS");
const webServicesModuleUrl = new URL("../../../../../lib-server/src/web-services.ts", import.meta.url).href;
const personsSchema = createInsertSchema(Persons);

const updateManyPersonsInputSchema = z.array(personsSchema.partial().required({ id: true }));
const addPersonInputSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().optional(),
  salutation: z.enum(SALUTATIONS).optional(),
  abbrv: z.string().optional(),
});
const deletePersonInputSchema = z.string();

const loadPersonsServices = async () => {
  return (await import(webServicesModuleUrl)) as {
    listPersons: () => Promise<unknown>;
    updateManyPersons: (input: z.infer<typeof updateManyPersonsInputSchema>) => Promise<void>;
    addPerson: (input: z.infer<typeof addPersonInputSchema>) => Promise<unknown>;
    deletePerson: (personId: string) => Promise<void>;
  };
};

export const persons = {
  list: editUsersProcedure.query(async () => (await loadPersonsServices()).listPersons()),

  updateMany: editUsersProcedure.input(updateManyPersonsInputSchema).mutation(async ({ input }) => {
    await (await loadPersonsServices()).updateManyPersons(input);
  }),

  add: editUsersProcedure
    .input(addPersonInputSchema)
    .mutation(async ({ input }) => (await loadPersonsServices()).addPerson(input)),

  delete: editUsersProcedure.input(deletePersonInputSchema).mutation(async ({ input }) => {
    await (await loadPersonsServices()).deletePerson(input);
  }),
} satisfies TRPCRouterRecord;
