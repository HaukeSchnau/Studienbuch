import p from "path";

export const getFilePath = (path: string) => {
  return p.join(process.env.TURBO_INVOCATION_DIR ?? process.cwd(), path);
};
