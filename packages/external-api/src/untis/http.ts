import { externalApiHttpConfig } from "../http/config";
import { withExternalApiResilience } from "../http/resilience";

export const withUntisHttpResilience = (operation: string) =>
  withExternalApiResilience({
    service: "untis",
    operation,
    policy: externalApiHttpConfig.untis,
  });
