import { SignedIn } from "../../features/account/AccountGates.tsx";
import { AppTabs } from "../../ui/navigation/AppTabs.tsx";

export default function TabsLayout() {
  return (
    <SignedIn>
      <AppTabs />
    </SignedIn>
  );
}
