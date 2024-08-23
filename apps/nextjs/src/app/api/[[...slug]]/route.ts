import { makeRestApi } from "@stu/rest";

const api = makeRestApi("/api");
const handler = api.nextHandler();

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;
export const OPTIONS = handler;
