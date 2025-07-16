import { getStates as getStatesFromApi, getTicketsForState as getTicketsForStateFromApi } from "@stu/external-api";

export const getStates = () => getStatesFromApi();

export const getTicketsForState = (state: string) => getTicketsForStateFromApi(state);

export type { WorkflowState, Issue } from "@stu/external-api";
