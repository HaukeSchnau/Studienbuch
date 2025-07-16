import { getLinearClient } from "./linearClient";

const VIEW_ID = "cbd58025-74b7-4581-af67-438c97ebd8c9";

export const getStates = async () => {
  const states = await getLinearClient()
    .workflowStates()
    .then((states) => states.nodes);

  states.sort((a, b) => a.position - b.position);

  return states;
};

export const getTicketsForState = async (stateId: string) => {
  const publicView = await getLinearClient().customView(VIEW_ID);

  const issuesResponse = await publicView.issues({
    filter: {
      state: {
        id: {
          eq: stateId,
        },
      },
    },
  });
  return issuesResponse.nodes;
};

export type { Issue, WorkflowState } from "@linear/sdk";
