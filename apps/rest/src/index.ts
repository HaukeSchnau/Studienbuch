import { handle } from "hono/vercel";

import { createBase } from "./base";

export const makeRestApi = (basePath: string) => {
  const app = createBase(basePath);

  return {
    app,
    nextHandler: () => handle(app),
  };
};
