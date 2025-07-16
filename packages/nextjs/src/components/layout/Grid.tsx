import type { ReactElement, ReactNode } from "react";

type Props<T> =
  | {
      data: T[];
      renderItem: (item: T) => ReactElement;
    }
  | {
      data?: never;

      children: ReactNode;
    };

export const Grid = <T,>(props: Props<T>) => {
  return (
    <div
      className="grid gap-10"
      style={{
        gridTemplateColumns: "repeat(auto-fill, minmax(15rem, 1fr))",
      }}
    >
      {props.data ? props.data.map((item) => props.renderItem(item)) : props.children}
    </div>
  );
};
