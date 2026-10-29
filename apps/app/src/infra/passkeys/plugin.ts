import { type ConfigPlugin, withAppBuildGradle, withEntitlementsPlist } from "expo/config-plugins";

// What native passkeys need from the build (design/spikes/passkey-prf.md).

// react-native-passkeys pins androidx.credentials 1.3.0-alpha01, which predates PRF on Android.
const credentials = "1.6.0";

/** Forces one androidx.credentials release for every dependency of the app module. */
export const forceCredentials = (gradle: string) =>
  gradle.includes("androidx.credentials:credentials:")
    ? gradle
    : `${gradle}
configurations.all {
    resolutionStrategy {
        force "androidx.credentials:credentials:${credentials}"
        force "androidx.credentials:credentials-play-services-auth:${credentials}"
    }
}
`;

/**
 * iOS offers a server's passkeys only to an app with its host among the associated domains. The
 * entitlement needs the capability on the App ID, a store record, so a build carries it only when
 * `associatedDomain` is set, per environment and with Hauke's go.
 */
export const withPasskeys: ConfigPlugin<{ readonly associatedDomain: string | undefined }> = (
  config,
  { associatedDomain },
) => {
  const android = withAppBuildGradle(config, (gradle) => {
    gradle.modResults.contents = forceCredentials(gradle.modResults.contents);

    return gradle;
  });

  return associatedDomain === undefined
    ? android
    : withEntitlementsPlist(android, (entitlements) => {
        const key = "com.apple.developer.associated-domains";
        const existing = entitlements.modResults[key];

        entitlements.modResults[key] = [
          ...(Array.isArray(existing) ? existing : []),
          `webcredentials:${associatedDomain}`,
        ];

        return entitlements;
      });
};
