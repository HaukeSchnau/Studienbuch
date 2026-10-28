import { FlatList, ScrollView } from "react-native";

const days = [1, 2, 3];
const listProps = { bounces: false };

export function WeekList() {
  return (
    <>
      {/* oxlint-disable-next-line studienbuch/require-registered-list-scroll -- fixture: a list the header can't track */}
      <FlatList data={days} renderItem={() => null} />
      <FlatList data={days} renderItem={() => null} contentInsetAdjustmentBehavior="automatic" />
      <ScrollView horizontal />
      {/* oxlint-disable-next-line studienbuch/require-registered-list-scroll -- fixture: a spread may lack the prop */}
      <ScrollView {...listProps} />
    </>
  );
}

export const observe = (element: Element) =>
  // oxlint-disable-next-line studienbuch/no-raw-resize-observer -- fixture: a raw ResizeObserver
  new ResizeObserver(() => undefined).observe(element);
