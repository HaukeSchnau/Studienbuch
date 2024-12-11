import type { ServerEventApplicators } from "@stu/lib";

export const serverApplicators: ServerEventApplicators = {
  "absence.recorded": {
    recipients: async (event) => [],
    related: async (event) => [],
  },
};
