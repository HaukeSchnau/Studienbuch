import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { lazy, Suspense } from "react";

import { ServerInfo } from "../diagnostics/ServerInfo.ts";
import { LabNotice } from "./LabNotice.tsx";

// One web build serves every server (M1 plan, choice 11), so the Lab's code, @stu/sync/lab with
// it, loads only once this server says it is a development or preview server.
const SyncLab = lazy(() =>
  import("./SyncLabScreen.tsx").then((module) => ({
    default: module.SyncLabScreen,
  })),
);

/** The Lab behind its run-time gate, in a browser. */
export function SyncLabRoute() {
  const info = useAtomValue(ServerInfo.info);

  return AsyncResult.match(info, {
    onInitial: () => <LabNotice text="Fragt den Server, ob es das Sync Lab hier gibt." />,
    onFailure: () => <LabNotice text="Der Server antwortet nicht." />,
    onSuccess: ({ value: { environment } }) =>
      environment === "development" || environment === "preview" ? (
        <Suspense fallback={<LabNotice text="Lädt die Geräte." />}>
          <SyncLab environment={environment} />
        </Suspense>
      ) : (
        <LabNotice text="Das Sync Lab gibt es nur auf Entwicklungs- und Vorschauservern." />
      ),
  });
}
