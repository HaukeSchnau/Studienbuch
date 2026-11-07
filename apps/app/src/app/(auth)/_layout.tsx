import { Slot } from "expo-router";

import { SignedOut } from "../../features/account/AccountGates.tsx";
import { AuthShell } from "../../ui/AuthShell.tsx";

// The code comes first, as on the old web: a link straight to a later step still has "Willkommen"
// to go back to.
export const unstable_settings = { anchor: "aktivieren" };

/**
 * Every step before an account is signed in shares one card, so moving from one to the next
 * changes the card's content and the card grows or shrinks to fit (the old web's AuthShell and the
 * Flutter app's setup).
 */
export default function AuthLayout() {
  return (
    <SignedOut>
      <AuthShell>
        <Slot />
      </AuthShell>
    </SignedOut>
  );
}
