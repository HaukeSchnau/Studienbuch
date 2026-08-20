import type { PropsWithChildren } from "react";
import { MockDataProvider } from "./mock/provider";

export function AppDataProvider({ children }: PropsWithChildren) {
  return <MockDataProvider>{children}</MockDataProvider>;
}
