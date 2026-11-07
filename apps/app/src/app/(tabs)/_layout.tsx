import { SignedIn } from "../../features/account/AccountGates.tsx";
import { AccountNotice } from "../../features/keys/AccountNotice.tsx";
import { OnboardingGate } from "../../features/onboarding/OnboardingGate.tsx";
import { AppTabs } from "../../ui/navigation/AppTabs.tsx";

export default function TabsLayout() {
  return (
    <SignedIn>
      <AccountNotice>
        <OnboardingGate>
          <AppTabs />
        </OnboardingGate>
      </AccountNotice>
    </SignedIn>
  );
}
