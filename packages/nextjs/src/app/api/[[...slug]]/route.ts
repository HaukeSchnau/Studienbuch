import { createBase } from "@stu/api";
import { handle } from "hono/vercel";

const api = createBase("/api");
const handler = handle(api);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;
export const OPTIONS = handler;
