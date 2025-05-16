/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1)
 * 2. You want to create a new middleware or type of procedure (see Part 3)
 *
 * tl;dr - this is where all the tRPC server stuff is created and plugged in.
 * The pieces you will need to use are documented accordingly near the end
 */
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import * as tables from "@stu/db/schema";

import { SYSTEM_USER } from ".";
import { env } from "../env";
import type { Logger } from "./interfaces/logger";
import type { Session } from "./interfaces/session";

export const getSession = async (
  sessionToken: string,
): Promise<Session | null> => {
  const session = await db.query.Sessions.findFirst({
    where: eq(tables.Sessions.token, sessionToken),
    with: {
      user: true,
    },
  });

  if (!session) {
    return null;
  }

  if (session.expires < new Date() || !session.user) {
    await db
      .delete(tables.Sessions)
      .where(eq(tables.Sessions.token, sessionToken));
    return null;
  }

  return {
    token: session.token,
    user: {
      id: session.user.id,
    },
  };
};

const getSystemSession = (): Session => {
  return {
    token: "",
    user: {
      id: SYSTEM_USER,
    },
  };
};

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async ({
  sessionToken,
  authority,
  source,
  log,
}: {
  source: string;
  log: Logger;
} & (
  | {
      sessionToken: string | null;
      authority?: never;
    }
  | { authority: "console"; sessionToken?: never }
)) => {
  const session: Session | null =
    authority === "console"
      ? getSystemSession()
      : sessionToken
        ? await getSession(sessionToken)
        : null;

  if (env.NODE_ENV === "development") {
    console.log(
      ">>> tRPC Request from",
      source,
      "by",
      session?.user.id ?? "Anonymous",
    );
  }

  return {
    session,
    log,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the trpc api is initialized, connecting the context and
 * transformer
 */
export const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
    },
  }),
});

/**
 * Create a server-side caller
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;
