/// <reference types="vinxi/types/server" />
import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";
import { getRouterManifest } from "@tanstack/react-start/router-manifest";

import { createRouter } from "./router";

export default createStartHandler({
  createRouter,
  getRouterManifest,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- TODO: not sure what's happening here
})(defaultStreamHandler);
