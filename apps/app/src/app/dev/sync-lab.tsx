import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { lazy, Suspense } from "react";
import { Platform } from "react-native";

import { ServerInfo } from "../../features/diagnostics/ServerInfo.ts";
import { LabNotice } from "../../features/sync-lab/LabNotice.tsx";

// One web build serves every server (M1 plan, choice 11), so the Lab's code, @stu/sync/lab with
// it, loads only once this server says it is a development or preview server.
const SyncLab = lazy(() =>
  import("../../features/sync-lab/SyncLabScreen.tsx").then((module) => ({
    default: module.SyncLabScreen,
  })),
);

export default function SyncLabRoute() {
  const info = useAtomValue(ServerInfo.info);

  // Three engines with their own databases suit a wide browser window, not a phone.
  if (Platform.OS !== "web") return <LabNotice text="Das Sync Lab läuft im Browser." />;

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
