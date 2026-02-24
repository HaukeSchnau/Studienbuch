import type { ReactElement } from "react";

export type Route<T extends string = string> = T;

export type NextPage<Props = Record<string, never>> = (props: Props) => ReactElement | null;

export interface Metadata {
  title?: string | { default?: string; template?: string; absolute?: string };
  description?: string;
  [key: string]: unknown;
}

export interface Viewport {
  width?: string | number;
  initialScale?: number;
  themeColor?: string;
  [key: string]: unknown;
}
