import { Link } from "@stu/ui/Link";
// oxlint-disable-next-line studienbuch/no-raw-router-link -- fixture: expo-router's Link outside RouteLink
import { Link as ScreenLink } from "expo-router";

export function Links() {
  return (
    <>
      <ScreenLink href="/stundenplan" asChild>
        <Link label="Stundenplan" />
      </ScreenLink>
      {/* oxlint-disable-next-line studienbuch/no-raw-router-link -- fixture: a text link with its own href */}
      <Link label="Woche" href="/woche" />
      <Link label="Neu laden" onPress={() => undefined} />
    </>
  );
}
