import { LabNotice } from "./LabNotice.tsx";

// Three engines with their own databases suit a wide browser window, not a phone. Metro picks
// this file on iOS and Android, so their bundles hold this sentence and none of the Lab.

export function SyncLabRoute() {
  return <LabNotice text="Das Sync Lab läuft im Browser." />;
}
