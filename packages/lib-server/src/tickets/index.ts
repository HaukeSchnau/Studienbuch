import { getStates as getStatesFromApi, getTicketsForState as getTicketsForStateFromApi } from "@stu/external-api";

export const getStates = () => getStatesFromApi();

export const getTicketsForState = (state: string) => getTicketsForStateFromApi(state);

export type { Issue, WorkflowState } from "@stu/external-api";
