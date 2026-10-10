// What the AI assistant keeps in this browser beyond its settings (#104), in
// IndexedDB: database "wireflow-ai", one key-value store "kv".
// - "deviceKey" and "apiKey": the remembered API key, encrypted (key-crypto.ts).
//   "Remember on this device" is ticked by default; unticked, nothing is stored.
// - "chat": the conversation, while "Keep chat after reload" is on (the default;
//   unticking it is remembered as keepChat: false).
// The settings (provider, model, whether to keep the chat) hold no secret and
// stay in localStorage["wireflow-ai"], which before this change also held a
// remembered key in plain text; migrateLegacyKey moves it here once.
import { newDeviceKey, seal, unseal } from "./key-crypto";

const DB = "wireflow-ai";
const STORE = "kv";
export const RECORDS = { deviceKey: "deviceKey", apiKey: "apiKey", chat: "chat" } as const;

let db: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  db ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB is blocked"));
  }).catch((err) => {
    db = null; // try again next time
    throw err;
  });
  return db;
}

// One transaction; resolves with its requests' results once it has committed.
async function run(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest[]): Promise<unknown[]> {
  const tx = (await openDb()).transaction(STORE, mode);
  const requests = fn(tx.objectStore(STORE));
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(requests.map((r) => r.result));
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
  });
}

/**
 * Whether this browser lets the page keep things here: IndexedDB opens, and
 * WebCrypto exists (only on https and localhost). If not, nothing is
 * remembered, and the panel says so.
 */
export async function storageAvailable(): Promise<boolean> {
  try {
    if (typeof indexedDB === "undefined" || !globalThis.crypto?.subtle) return false;
    await openDb();
    return true;
  } catch {
    return false;
  }
}

/** Encrypt the key under a new device key and store both, replacing what was there. */
export async function rememberKey(apiKey: string) {
  const deviceKey = await newDeviceKey();
  const sealed = await seal(deviceKey, apiKey);
  await run("readwrite", (s) => [s.put(deviceKey, RECORDS.deviceKey), s.put(sealed, RECORDS.apiKey)]);
}

/** The remembered key, or null. A record that can't be decrypted is deleted. */
export async function loadKey(): Promise<string | null> {
  const [deviceKey, sealed] = await run("readonly", (s) => [s.get(RECORDS.deviceKey), s.get(RECORDS.apiKey)]);
  if (!(deviceKey instanceof CryptoKey) || sealed === undefined) return null;
  try {
    return await unseal(deviceKey, sealed);
  } catch {
    await forgetKey();
    return null;
  }
}

/** Delete both records of the remembered key. */
export const forgetKey = () =>
  run("readwrite", (s) => [s.delete(RECORDS.apiKey), s.delete(RECORDS.deviceKey)]).then(() => undefined);

export const saveChat = (chat: unknown) => run("readwrite", (s) => [s.put(chat, RECORDS.chat)]).then(() => undefined);
export const loadChat = () => run("readonly", (s) => [s.get(RECORDS.chat)]).then(([chat]) => chat);
export const clearChat = () => run("readwrite", (s) => [s.delete(RECORDS.chat)]).then(() => undefined);

// The settings in localStorage. They never hold the key any more.
const SETTINGS = "wireflow-ai";
export type Settings = { provider?: string; model?: string; keepChat?: boolean };

function readSettings(): Record<string, unknown> {
  try {
    const v = JSON.parse(localStorage.getItem(SETTINGS) ?? "null");
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

export function loadSettings(): Settings {
  const { provider, model, keepChat } = readSettings();
  return {
    ...(typeof provider === "string" && { provider }),
    ...(typeof model === "string" && { model }),
    ...(typeof keepChat === "boolean" && { keepChat }),
  };
}

export function storeSettings(settings: Settings) {
  try {
    localStorage.setItem(SETTINGS, JSON.stringify(settings));
  } catch {
    // Storage blocked: the settings just won't be remembered.
  }
}

/**
 * A key an earlier version remembered in plain text in the settings, moved once:
 * encrypted into IndexedDB (where this browser allows it), then deleted from the
 * settings, whose other values stay. The plain text goes even if it couldn't be
 * encrypted; the key is then only used until the tab closes. Null if there was none.
 */
export async function migrateLegacyKey(): Promise<{ key: string; remembered: boolean } | null> {
  const { apiKey } = readSettings();
  if (apiKey === undefined) return null;
  const key = typeof apiKey === "string" && apiKey.trim() ? apiKey : null;
  let remembered = false;
  if (key && (await storageAvailable())) {
    try {
      await rememberKey(key);
      remembered = true;
    } catch {
      // Not stored: used for this tab only.
    }
  }
  storeSettings(loadSettings());
  return key ? { key, remembered } : null;
}
