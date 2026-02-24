export type AppRouter = Record<string, never>;

export const createTRPCContext = (context: unknown) => context as any;

export const createCaller = (_createContext: unknown) => ({}) as any;
