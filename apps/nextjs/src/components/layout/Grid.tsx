import type { ReactElement } from "react";

interface Props<T> {
  data: T[];
  renderItem: (item: T) => ReactElement;
}

export const Grid = <T,>({ data, renderItem }: Props<T>) => {
  return (
    <div
      className="grid gap-10"
      style={{
        gridTemplateColumns: "repeat(auto-fill, minmax(15rem, 1fr))",
      }}
    >
      {data.map((item) => renderItem(item))}
    </div>
  );
};
