import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { profileAtom, updateProfileAtom } from "./profile-atoms";

export function useProfile() {
  const profile = useAtomValue(profileAtom);
  const updateProfile = useAtomSet(updateProfileAtom);

  return { profile, updateProfile };
}
