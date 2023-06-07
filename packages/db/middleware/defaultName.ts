/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

// Note: This is a middleware that will be called before any create or update operation on the User model.
// It will set the name field to the email address if it is not already set.
// This is needed because the email provider from NextAuth does not provide a name.

import { type Prisma } from "@prisma/client";

export const defaultName: Prisma.Middleware = async (params, next) => {
  if (params.model === "User") {
    if (params.action === "create") {
      params.args.data = {
        ...params.args.data,
        name: params.args.data.name || params.args.data.email,
      };
    }
  }
  return next(params);
};
