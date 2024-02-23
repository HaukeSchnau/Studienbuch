import jwt from "jsonwebtoken";
import { z } from "zod";

import { env } from "../env";

const payloadSchema = z.object({
  user: z
    .object({
      name: z.string(),
    })
    .nullable(),
});

export type JwtPayload = z.infer<typeof payloadSchema>;

export const verifyAndDecodeJwt = (token: string): JwtPayload | null => {
  const payload = jwt.verify(token, env.JWT_SECRET);
  const result = payloadSchema.safeParse(payload);
  if (!result.success) {
    return null;
  }
  return result.data;
};

export const decodeJwt = (token: string): JwtPayload | null => {
  const payload = jwt.decode(token);
  const result = payloadSchema.safeParse(payload);
  if (!result.success) {
    return null;
  }
  return result.data;
};

export const createJwt = (payload: JwtPayload) => {
  return jwt.sign(payload, env.JWT_SECRET);
};
