import { screenNames } from "@stu/observability/browser";
import { usePathname } from "expo-router";
import { useEffect, useRef } from "react";
import { useMobileTelemetry } from "./mobile-telemetry-provider";

const applicationStartedAt = Date.now();

export function MobileNavigationTelemetry() {
  const pathname = usePathname();
  const telemetry = useMobileTelemetry();
  const previous = useRef<string | undefined>(undefined);

  useEffect(() => {
    const screen = screenNames.find((candidate) => pathname.includes(candidate)) ?? "overview";
    if (previous.current === undefined) {
      telemetry.recordRender(Date.now() - applicationStartedAt, screen);
    } else if (previous.current !== pathname) {
      telemetry.recordNavigation(screen);
    }
    previous.current = pathname;
  }, [pathname, telemetry]);

  return null;
}
