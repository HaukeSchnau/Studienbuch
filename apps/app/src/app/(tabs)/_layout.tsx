import { SignedIn } from "../../features/account/AccountGates.tsx";
import { AccountNotice } from "../../features/keys/AccountNotice.tsx";
import { AppTabs } from "../../ui/navigation/AppTabs.tsx";

export default function TabsLayout() {
  return (
    <SignedIn>
      <AccountNotice>
        <AppTabs />
      </AccountNotice>
    </SignedIn>
  );
}
