import { requireOptionalNativeModule } from "expo-modules-core";

type DevMenuPreferencesModule = {
  setPreferencesAsync(settings: {
    isOnboardingFinished?: boolean;
    showFloatingActionButton?: boolean;
    showsAtLaunch?: boolean;
  }): Promise<void>;
};

let didConfigureDevMenu = false;

export function configureDevelopmentMenuPreferences() {
  if (!__DEV__ || didConfigureDevMenu) {
    return;
  }

  didConfigureDevMenu = true;

  const preferences = requireOptionalNativeModule<DevMenuPreferencesModule>("DevMenuPreferences");

  void preferences?.setPreferencesAsync({
    isOnboardingFinished: true,
    showFloatingActionButton: false,
    showsAtLaunch: false,
  });
}
