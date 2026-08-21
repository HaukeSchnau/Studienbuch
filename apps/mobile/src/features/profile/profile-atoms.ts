import type { UserProfile } from "~/compat/mobile-v0";
import { Atom } from "effect/unstable/reactivity";

const emptyProfile: UserProfile = {
  name: "",
  isOfAge: false,
  yearId: "",
  classId: "",
  schoolName: "",
  licenseKey: "",
};

export const profileAtom = Atom.make(emptyProfile).pipe(
  Atom.keepAlive,
  Atom.withLabel("profile:current"),
);

export const updateProfileAtom = Atom.writable(
  () => undefined,
  (context, patch: Partial<UserProfile>) => {
    context.set(profileAtom, { ...context.get(profileAtom), ...patch });
  },
).pipe(Atom.withLabel("profile:update"));
