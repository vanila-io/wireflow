// The remembered API key's encryption (#104 section 3.4), with Node's WebCrypto
// (the same API the browser has). IndexedDB is covered in e2e/ai-storage.spec.ts.
import { describe, expect, it } from "vitest";
import { isSealed, newDeviceKey, seal, unseal } from "@/lib/ai/key-crypto";

// Obviously fake.
const KEY = "sk-ant-test-0000-not-a-real-key-wireflow";
const bytes = (b: ArrayBuffer | Uint8Array) => Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b));

describe("key encryption", () => {
  it("round-trips the key under a non-extractable AES-GCM key", async () => {
    const device = await newDeviceKey();
    expect(device.extractable).toBe(false);
    expect(device.algorithm).toMatchObject({ name: "AES-GCM", length: 256 });
    await expect(crypto.subtle.exportKey("raw", device)).rejects.toThrow();
    expect(await unseal(device, await seal(device, KEY))).toBe(KEY);
  });

  it("never stores the key's text, and uses a fresh 12-byte IV for every encryption", async () => {
    const device = await newDeviceKey();
    const a = await seal(device, KEY);
    const b = await seal(device, KEY);
    expect(isSealed(a)).toBe(true);
    expect(a.iv.byteLength).toBe(12);
    expect(bytes(a.iv).equals(bytes(b.iv))).toBe(false);
    expect(bytes(a.ct).equals(bytes(b.ct))).toBe(false);
    for (const s of [a, b]) {
      const raw = bytes(s.ct);
      expect(raw.includes(Buffer.from(KEY))).toBe(false);
      expect(raw.includes(Buffer.from("sk-ant"))).toBe(false);
      expect(raw.toString("latin1")).not.toContain("not-a-real-key");
    }
  });

  it("refuses another device key, a changed ciphertext or IV, and malformed records", async () => {
    const device = await newDeviceKey();
    const sealed = await seal(device, KEY);
    await expect(unseal(await newDeviceKey(), sealed)).rejects.toThrow();

    const ct = new Uint8Array(sealed.ct.slice(0));
    ct[0] ^= 1;
    await expect(unseal(device, { ...sealed, ct: ct.buffer })).rejects.toThrow();
    const iv = sealed.iv.slice();
    iv[0] ^= 1;
    await expect(unseal(device, { ...sealed, iv })).rejects.toThrow();

    for (const bad of [
      null,
      KEY,
      { v: 2, iv: sealed.iv, ct: sealed.ct },
      { v: 1, iv: new Uint8Array(8), ct: sealed.ct },
      { v: 1, iv: sealed.iv },
    ]) {
      await expect(unseal(device, bad)).rejects.toThrow("Not a sealed record");
    }
  });
});
