import crypto from "node:crypto";

export const createSession = (user: { id: string }) => {
  return {
    expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // in 30 days
    token: crypto.randomUUID(),
    user: user.id,
  };
};
