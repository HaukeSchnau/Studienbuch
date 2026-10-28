// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: an effect in a feature
import { useEffect, useState } from "react";

// oxlint-disable-next-line studienbuch/import-boundaries -- fixture: the app bundles the sync server
export { Push } from "@stu/sync/server";

export function Timetable() {
  const [day] = useState(1);

  useEffect(() => undefined, []);

  return day;
}
