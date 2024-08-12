/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  MutationProcedure,
  QueryProcedure,
  Router,
} from "@trpc/server/unstable-core-do-not-import";

interface LocalQuery<Input, Output> {
  persist: (input: Input, output: Output) => void | Promise<void>;
  read: (input: Input) => Output | Promise<Output>;
}
type SubsetRouterDef<T extends Record<string, any>> = {
  [K in keyof T]?: T[K] extends QueryProcedure<infer TDef>
    ? LocalQuery<TDef["input"], TDef["output"]>
    : T[K] extends MutationProcedure<any>
      ? "mutation"
      : T[K] extends Record<string, any>
        ? SubsetRouterDef<T[K]>
        : never;
};
export type ClientRouter<T extends Router<any, any>> = SubsetRouterDef<
  T["_def"]["procedures"]
>;

export const findLocalProcedure = <TAppRouter extends Router<any, any>>(
  clientRouter: ClientRouter<TAppRouter>,
  path: string[],
): LocalQuery<unknown, unknown> | undefined => {
  let localProcedure = clientRouter;
  while (path.length) {
    const key = path.shift();
    if (!key) break;
    // @ts-expect-error - we know this is safe
    localProcedure = localProcedure[key];
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!localProcedure) break;
  }
  return localProcedure as any;
};
