// Encryption of the remembered API key (#104, design section 3.4): AES-GCM with
// a 256-bit device key that WebCrypto creates as non-extractable, so its bytes
// can never be read, exported or copied out of the browser; only used. Both the
// device key and the ciphertext are kept in IndexedDB (see browser-store.ts).
//
// What this protects against: the key showing up in plain text when someone
// looks at the browser's storage (devtools, an "export storage" tool, a
// screenshot, a dump of the storage files). What it does not: code running on
// this page or a browser extension can ask the browser to decrypt it, and
// whoever has this browser profile has the device key next to the ciphertext.

/** The ciphertext as stored: a fresh 12-byte IV for every encryption. */
export type Sealed = { v: 1; iv: Uint8Array; ct: ArrayBuffer };

// Binds a ciphertext to what it is, so no other record can be swapped in for it.
const PURPOSE = new TextEncoder().encode("wireflow-ai/api-key/v1");

export const newDeviceKey = (): Promise<CryptoKey> =>
  crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);

export async function seal(key: CryptoKey, text: string): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: PURPOSE },
    key,
    new TextEncoder().encode(text)
  );
  return { v: 1, iv, ct };
}

export const isSealed = (value: unknown): value is Sealed =>
  typeof value === "object" &&
  value !== null &&
  (value as Sealed).v === 1 &&
  (value as Sealed).iv instanceof Uint8Array &&
  (value as Sealed).iv.byteLength === 12 &&
  (value as Sealed).ct instanceof ArrayBuffer;

/** The text back; throws if the record is malformed, was changed, or was sealed with another key. */
export async function unseal(key: CryptoKey, sealed: unknown): Promise<string> {
  if (!isSealed(sealed)) throw new Error("Not a sealed record");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: sealed.iv as Uint8Array<ArrayBuffer>, additionalData: PURPOSE },
    key,
    sealed.ct
  );
  return new TextDecoder().decode(plain);
}
