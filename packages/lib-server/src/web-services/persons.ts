import { asc, eq } from "@stu/db";
import { db } from "@stu/db/client";
import { Persons } from "@stu/db/schema";
import { SALUTATIONS } from "@stu/lib";
import { z } from "zod";

const updatePersonInputSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  salutation: z.enum(SALUTATIONS).nullable().optional(),
  abbrv: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
});

export const updateManyPersonsInputSchema = z.array(updatePersonInputSchema);

export const addPersonInputSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().optional(),
  salutation: z.enum(SALUTATIONS).optional(),
  abbrv: z.string().optional(),
});

export const deletePersonInputSchema = z.string();

export type UpdateManyPersonsInput = z.infer<typeof updateManyPersonsInputSchema>;
export type AddPersonInput = z.infer<typeof addPersonInputSchema>;

export const listPersons = async () => {
  return await db.query.Persons.findMany({
    orderBy: [asc(Persons.lastName), asc(Persons.firstName)],
  });
};

export const updateManyPersons = async (input: UpdateManyPersonsInput): Promise<void> => {
  await Promise.all(
    input.map((update) => {
      return db.update(Persons).set(update).where(eq(Persons.id, update.id));
    }),
  );
};

export const addPerson = async (input: AddPersonInput) => {
  return db.insert(Persons).values({
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    salutation: input.salutation,
    abbrv: input.abbrv,
  });
};

export const deletePerson = async (personId: string): Promise<void> => {
  await db.delete(Persons).where(eq(Persons.id, personId));
};
