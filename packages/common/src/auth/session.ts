import { z } from "zod";

export const sessionSchema = z.object({
  token: z.string(),
  expires: z.coerce.date(),
  user: z
    .object({
      id: z.string(),
      email: z.string(),
      name: z.string(),
      image: z.string().nullable(),
    })
    .nullable(),
});

export type Session = z.infer<typeof sessionSchema>;
export type AuthenticatedSession = Omit<Session, "user"> & {
  user: NonNullable<Session["user"]>;
};

export const isAuthenticated = (
  session: Session | null,
): session is AuthenticatedSession => {
  return !!session?.user;
};
