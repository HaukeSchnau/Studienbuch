import type { AccessApi } from "@stu/api";
import type { Organization } from "@stu/core";
import { WebRpc } from "#/infra/rpc/atoms.ts";

export type ReservationView = AccessApi.ReservationView;
export type SchoolAccessView = AccessApi.SchoolAccessView;
export type AccountView = AccessApi.AccountView;

export const accountReactivity = { account: [] } as const;

export const reservationReactivity = (token: Organization.SchoolAccessReservationToken) => ({
  reservation: [token],
});

export const accountAtom = WebRpc.query("Access.GetAccount", undefined, {
  reactivityKeys: accountReactivity,
  timeToLive: "5 minutes",
});

export const reservationAtom = (token: Organization.SchoolAccessReservationToken) =>
  WebRpc.query(
    "Access.InspectReservation",
    { token },
    {
      reactivityKeys: reservationReactivity(token),
      timeToLive: "5 minutes",
    },
  );

export const reserveAccessMutation = WebRpc.mutation("Access.Reserve");
export const completeReservationMutation = WebRpc.mutation("Access.CompleteReservation");
export const saveProfileMutation = WebRpc.mutation("Access.SaveProfile");
