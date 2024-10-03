import type { Key, ReactNode } from "react";
import { View } from "react-native";

interface Props<T> {
  items: T[];
  render: (item: T) => ReactNode;
  getKey: (item: T) => Key;
  gap?: number;
}

export const Table = <T,>({ items, render, getKey, gap = 12 }: Props<T>) => {
  return (
    <View className="flex flex-row flex-wrap">
      {items.map((item, idx) => (
        <View
          key={getKey(item)}
          style={{
            width: "50%",
            paddingLeft: idx % 2 === 1 ? gap / 2 : 0,
            paddingRight: idx % 2 === 0 ? gap / 2 : 0,
            paddingTop: idx >= 2 ? gap : 0,
          }}
        >
          {render(item)}
        </View>
      ))}
    </View>
  );
};
