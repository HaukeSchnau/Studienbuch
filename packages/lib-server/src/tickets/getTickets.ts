import {
  getStates as getStatesFromApi,
  getTicketsForState as getTicketsForStateFromApi,
} from "@schnau/external-api";

export const getStates = () => getStatesFromApi();

export const getTicketsForState = (state: string) =>
  getTicketsForStateFromApi(state);

export type { WorkflowState, Issue } from "@schnau/external-api";
