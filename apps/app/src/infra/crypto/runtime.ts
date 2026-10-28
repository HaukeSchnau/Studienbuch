import { install } from "react-native-quick-crypto";

// Hermes has no WebCrypto. quick-crypto installs `crypto.getRandomValues` and `crypto.subtle` with
// native implementations (design/spikes/native.md), so every platform runs the same WebCrypto code.
install();

/** What implements WebCrypto on this platform. */
export const provider = "quick-crypto mit OpenSSL";
