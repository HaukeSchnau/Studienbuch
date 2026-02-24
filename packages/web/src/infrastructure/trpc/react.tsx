"use client";

import type { ReactNode } from "react";

const deepProxy = (): any =>
  new Proxy(
    {},
    {
      get: () => deepProxy(),
      apply: () => deepProxy(),
    },
  );

export const api: any = deepProxy();

export function TRPCReactProvider(props: { children: ReactNode }) {
  return <>{props.children}</>;
}
