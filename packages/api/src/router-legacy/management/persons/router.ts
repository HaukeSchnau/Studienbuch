import type { TRPCRouterRecord } from "@trpc/server";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { asc, eq } from "@stu/db";
import { db } from "@stu/db/client";
import { Persons } from "@stu/db/schema";
import { SALUTATIONS } from "@stu/lib";

import { permissionProcedure } from "../../../procedures";

const editUsersProcedure = permissionProcedure("EDIT_USERS");

const PersonsSchema = createInsertSchema(Persons);

export const persons = {
  list: editUsersProcedure.query(async () => {
    return await db.query.Persons.findMany({
      orderBy: [asc(Persons.lastName), asc(Persons.firstName)],
    });
  }),

  updateMany: editUsersProcedure
    .input(z.array(PersonsSchema.partial().required({ id: true })))
    .mutation(async ({ input }) => {
      await Promise.all(
        input.map((update) => {
          return db.update(Persons).set(update).where(eq(Persons.id, update.id));
        }),
      );
    }),

  add: editUsersProcedure
    .input(
      z.object({
        firstName: z.string(),
        lastName: z.string(),
        email: z.string().optional(),
        salutation: z.enum(SALUTATIONS).optional(),
        abbrv: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) =>
      db.insert(Persons).values({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        salutation: input.salutation,
        abbrv: input.abbrv,
      }),
    ),

  delete: editUsersProcedure.input(z.string()).mutation(async ({ input }) => {
    await db.delete(Persons).where(eq(Persons.id, input));
  }),
} satisfies TRPCRouterRecord;
