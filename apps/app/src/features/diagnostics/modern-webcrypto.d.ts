// WebCrypto's modern algorithms (WICG "Modern Algorithms in WebCrypto"), which Node 26 and
// quick-crypto implement and TypeScript's DOM library doesn't describe yet.
type ModernKeyUsage = KeyUsage | "encapsulateBits" | "decapsulateBits";

interface SubtleCrypto {
  importKey(
    format: "raw-seed",
    keyData: BufferSource,
    algorithm: AlgorithmIdentifier,
    extractable: boolean,
    keyUsages: ReadonlyArray<ModernKeyUsage>,
  ): Promise<CryptoKey>;
  exportKey(format: "raw-public", key: CryptoKey): Promise<ArrayBuffer>;
  getPublicKey(key: CryptoKey, keyUsages: ReadonlyArray<ModernKeyUsage>): Promise<CryptoKey>;
  encapsulateBits(
    algorithm: AlgorithmIdentifier,
    encapsulationKey: CryptoKey,
  ): Promise<{ readonly ciphertext: ArrayBuffer; readonly sharedKey: ArrayBuffer }>;
  decapsulateBits(
    algorithm: AlgorithmIdentifier,
    decapsulationKey: CryptoKey,
    ciphertext: BufferSource,
  ): Promise<ArrayBuffer>;
}
