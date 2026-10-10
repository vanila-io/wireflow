"use client";
// The AI assistant (#105): bring your own key, the browser talks straight to the
// provider. Loaded on first open (see use-ai-panel.tsx). Model output is shown as
// plain text only.
import { useEffect, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { Lock, Send, Sparkles, Square, X } from "lucide-react";
import { runRequest, TOOLS, type AgentEditor } from "@/lib/ai/agent";
import * as saved from "@/lib/ai/browser-store";
import {
  parseChatRecord,
  stepFingerprint,
  type AssistantMessage,
  type ChatRecord,
  type Message,
} from "@/lib/ai/chat-record";
import { applyActions } from "@/lib/ai/diagram";
import { systemPrompt } from "@/lib/ai/prompt";
import { getProvider, providers } from "@/lib/ai/providers";
import type { AiErrorKind, Chat } from "@/lib/ai/providers/types";
import { stepState } from "@/lib/diagram/history";
import { useStore, useStoreState } from "../editor/store-context";

export type AiPanelProps = { open: boolean; onClose: () => void };

// Settings (provider, model, whether to keep the chat) live in this browser's
// localStorage. The key stays in memory unless the user ticks "Remember on this
// device"; it is then stored encrypted in IndexedDB, and so is the chat while
// "Keep chat after reload" is on (lib/ai/browser-store.ts).

const money = (usd: number) => `$${usd < 0.01 ? usd.toFixed(4) : usd.toFixed(3)}`;
const maskKey = (key: string) => `${key.slice(0, 7)}…${key.slice(-4)}`;

const STATUS_NOTE: Partial<Record<AssistantMessage["status"], string>> = {
  refused: "The model declined this request.",
  truncated: "The response was cut off; nothing more was applied.",
  step_limit: "Stopped after too many steps.",
};
const statusNote = (m: AssistantMessage) =>
  m.status === "refused" && m.refusal ? `${STATUS_NOTE.refused} ${m.refusal}` : STATUS_NOTE[m.status];

const STATE_PREFIX = {
  latest: "Applied: ",
  applied: "Applied: ",
  unknown: "Applied: ",
  undone: "Undone: ",
  replaced: "Replaced by an opened file: ",
};

let nextId = 0;

export default function AiPanel({ open, onClose }: AiPanelProps) {
  const store = useStore();
  // Re-render on every store change (undo and redo included), so each AI change
  // shows whether it is still applied and can be undone from here.
  useStoreState(store);
  const history = store.history();
  const rf = useReactFlow();

  const [settings] = useState(saved.loadSettings);
  const [providerId, setProviderId] = useState(settings.provider ?? providers[0].id);
  const provider = getProvider(providerId);
  const [model, setModel] = useState(
    provider.models.some((m) => m.id === settings.model) ? settings.model! : provider.defaultModel
  );
  // undefined while the remembered key (if any) is being read.
  const [apiKey, setApiKey] = useState<string | null | undefined>(undefined);
  // Whether this browser lets the panel keep the key and the chat (null: not known yet).
  const [canStore, setCanStore] = useState<boolean | null>(null);
  const [remembered, setRemembered] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");
  const [remember, setRemember] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [checkingKey, setCheckingKey] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [keepChat, setKeepChat] = useState(!!settings.keepChat);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionCost, setSessionCost] = useState(0);

  const chat = useRef<Chat | null>(null);
  // A kept chat's provider history, until the next request continues it.
  const restoredHistory = useRef<unknown>(undefined);
  const abort = useRef<AbortController | null>(null);
  const listEnd = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    // Braces matter: Chromium's scrollIntoView returns a Promise, which React would take as a cleanup.
    listEnd.current?.scrollIntoView({ block: "end" });
  }, [messages]);
  useEffect(() => {
    if (open && apiKey) composer.current?.focus();
  }, [open, apiKey]);

  // On first open: what this browser kept. A key an earlier version kept in plain
  // text is encrypted and its plain text deleted (once); then the remembered key,
  // and the kept chat if "Keep chat after reload" is on.
  useEffect(() => {
    let live = true;
    (async () => {
      const ok = await saved.storageAvailable();
      const legacy = await saved.migrateLegacyKey();
      const key = legacy?.key ?? (ok ? await saved.loadKey().catch(() => null) : null);
      let kept: ChatRecord | null = null;
      if (ok && settings.keepChat) {
        const value = await saved.loadChat().catch(() => null);
        kept = parseChatRecord(value, { provider: providerId, model, history: store.history() });
      }
      if (!live) return;
      setCanStore(ok);
      setApiKey(key);
      setRemembered(legacy ? legacy.remembered : !!key);
      if (kept) {
        restoredHistory.current = kept.history;
        setMessages(kept.messages);
      }
    })();
    return () => {
      live = false;
    };
    // Once, with the settings the panel opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While "Keep chat after reload" is on, the chat is stored after every request
  // (never in the middle of one): the messages on screen, and the provider's
  // history, which holds only answered requests, unchanged.
  useEffect(() => {
    if (!keepChat || !canStore || busy || !messages.length) return;
    const record: ChatRecord = {
      v: 1,
      provider: providerId,
      model,
      messages,
      history: chat.current ? chat.current.history() : restoredHistory.current,
    };
    saved.saveChat(record).catch(() => {});
  }, [keepChat, canStore, busy, messages, providerId, model]);

  const newChat = () => {
    abort.current?.abort();
    chat.current = null;
    restoredHistory.current = undefined;
    setMessages([]);
    if (canStore) saved.clearChat().catch(() => {});
  };

  function changeKeepChat(on: boolean) {
    setKeepChat(on);
    saved.storeSettings({ provider: providerId, model, ...(on && { keepChat: true }) });
    if (!on) saved.clearChat().catch(() => {});
  }

  // The part of the canvas the user can see, in canvas coordinates: the canvas
  // minus what the open panel covers. The model places new screens in it.
  const visibleArea = () => {
    const canvas = document.querySelector(".react-flow")!.getBoundingClientRect();
    // A closed panel (closed while a request runs) covers nothing.
    const box = panel.current?.getBoundingClientRect();
    const covered = box && box.width > 0 ? box.left : canvas.right;
    const right = Math.max(canvas.left, Math.min(canvas.right, covered));
    const from = rf.screenToFlowPosition({ x: canvas.left, y: canvas.top });
    const to = rf.screenToFlowPosition({ x: right, y: canvas.bottom });
    return {
      x: Math.round(from.x),
      y: Math.round(from.y),
      width: Math.round(to.x - from.x),
      height: Math.round(to.y - from.y),
    };
  };

  const update = (id: string, fn: (m: AssistantMessage) => AssistantMessage) =>
    setMessages((ms) => ms.map((m) => (m.id === id && m.role === "assistant" ? fn(m) : m)));

  async function send() {
    const text = draft.trim();
    if (!text || busy || !apiKey) return;
    setDraft("");
    setBusy(true);

    const id = `a${++nextId}`;
    setMessages((ms) => [
      ...ms,
      { id: `u${nextId}`, role: "user", text },
      { id, role: "assistant", text: "", thinking: "", applied: [], status: "streaming" },
    ]);

    chat.current ??= provider.createChat({
      apiKey,
      model,
      system: systemPrompt(),
      tools: TOOLS,
      history: restoredHistory.current,
    });
    const controller = new AbortController();
    abort.current = controller;
    // The reply as streamed so far, and where the current step's part starts,
    // so a re-sent step (see the provider's onRetry) replaces its own part.
    let reply = "";
    let thinking = "";
    let step = { text: 0, thinking: 0, gap: false };
    let gap = false; // separate the text of consecutive steps
    let lastStep: number | null = null;
    // The editor as the agent sees it: the live diagram, and each plan applied as one undo step.
    const editor: AgentEditor = {
      read: () => ({ data: store.diagram(), selected: store.selectedIds(), view: visibleArea() }),
      apply: (actions) => {
        lastStep = store.apply((d) => applyActions(d, actions), { kind: "ai" });
      },
    };

    try {
      const result = await runRequest({
        chat: chat.current,
        text,
        editor,
        signal: controller.signal,
        onEvent: (e) => {
          if (e.type === "step") {
            gap = e.step > 0;
            step = { text: reply.length, thinking: thinking.length, gap };
          }
          if (e.type === "retry") {
            reply = reply.slice(0, step.text);
            thinking = thinking.slice(0, step.thinking);
            gap = step.gap;
            update(id, (m) => ({ ...m, text: reply, thinking }));
          }
          if (e.type === "text") {
            reply = reply ? reply + (gap ? "\n\n" : "") + e.delta : e.delta;
            gap = false;
            update(id, (m) => ({ ...m, text: reply }));
          }
          if (e.type === "thinking") {
            thinking += e.delta;
            update(id, (m) => ({ ...m, thinking }));
          }
          if (e.type === "usage") {
            update(id, (m) => ({ ...m, cost: (m.cost ?? 0) + e.usage.usd }));
            setSessionCost((c) => c + e.usage.usd);
          }
          if (e.type === "applied") {
            const step = lastStep;
            const fingerprint = step === null ? undefined : stepFingerprint(store.history(), step);
            update(id, (m) => ({
              ...m,
              applied: [...m.applied, { count: e.count, summary: e.summary, step, fingerprint }],
            }));
          }
        },
      });
      update(id, (m) => ({ ...m, status: result.status, refusal: result.refusal }));
    } catch (err) {
      const e = err as { kind?: AiErrorKind; message?: string };
      update(id, (m) => ({
        ...m,
        status: e.kind === "aborted" ? "aborted" : "error",
        error: e.message,
        errorKind: e.kind,
      }));
    } finally {
      abort.current = null;
      setBusy(false);
    }
  }

  async function saveKey() {
    const key = keyDraft.trim();
    if (!key) return;
    setCheckingKey(true);
    setKeyError(null);
    try {
      await provider.validateKey({ apiKey: key, model });
    } catch (err) {
      setKeyError((err as Error).message);
      setCheckingKey(false);
      return;
    }
    // Remembered: encrypted in IndexedDB. Not remembered: nothing is stored, and a
    // key remembered before is deleted.
    let stored = false;
    if (canStore) {
      try {
        if (remember) {
          await saved.rememberKey(key);
          stored = true;
        } else await saved.forgetKey();
      } catch {
        // Couldn't store it: it is used for this tab only (the footer shows no lock).
      }
    }
    setApiKey(key);
    setRemembered(stored);
    setKeyDraft("");
    chat.current = null;
    setCheckingKey(false);
  }

  function forgetKey() {
    newChat();
    setApiKey(null);
    setRemembered(false);
    setRemember(false);
    if (canStore) saved.forgetKey().catch(() => {});
  }

  // Screen readers hear each finished reply once, not every streamed token.
  const last = messages.at(-1);
  const announcement =
    !busy && last?.role === "assistant"
      ? [
          last.text,
          ...last.applied.map((a) => `Applied: ${a.summary || `${a.count} changes`}.`),
          last.error ?? statusNote(last),
        ]
          .filter(Boolean)
          .join(" ")
      : "";

  const button = "rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition disabled:opacity-50";
  const link = "text-xs font-semibold text-wire-blue hover:underline disabled:opacity-50";

  return (
    <aside
      ref={panel}
      aria-label="AI assistant"
      hidden={!open}
      data-no-shortcuts
      className="ai-panel absolute inset-y-0 right-0 z-30 flex w-[420px] max-w-full flex-col max-sm:fixed max-sm:inset-x-0 max-sm:top-14 max-sm:w-full border-l border-wire-border bg-white shadow-[0_8px_30px_rgba(29,28,40,0.15)]"
    >
      <header className="flex items-center gap-2 border-b border-wire-border px-4 py-3">
        <h2 className="flex flex-1 items-center gap-1.5 text-sm font-bold text-ink">
          <Sparkles size={14} className="text-wire-blue" aria-hidden />
          AI assistant
        </h2>
        {providers.length > 1 && (
          <select
            aria-label="Provider"
            value={providerId}
            onChange={(e) => {
              const p = getProvider(e.target.value);
              setProviderId(p.id);
              setModel(p.defaultModel);
              forgetKey();
            }}
            className="rounded-md border border-wire-border px-2 py-1 text-xs"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Model"
          value={model}
          onChange={(e) => {
            setModel(e.target.value);
            newChat(); // a conversation stays on one model
            saved.storeSettings({ provider: providerId, model: e.target.value, ...(keepChat && { keepChat: true }) });
          }}
          className="max-w-44 rounded-md border border-wire-border px-2 py-1 text-xs text-ink"
        >
          {provider.models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} (${m.price.input}/${m.price.output} per MTok)
            </option>
          ))}
        </select>
        <button
          onClick={onClose}
          aria-label="Close the AI assistant"
          className="rounded p-1 text-ink-soft hover:text-ink"
        >
          <X size={16} aria-hidden />
        </button>
      </header>

      {apiKey === undefined ? (
        // Reading the remembered key: a few milliseconds, so nothing to show.
        <div aria-busy="true" className="flex-1" />
      ) : !apiKey ? (
        <div className="flex flex-col gap-3 p-4 text-xs leading-5 text-ink">
          <p>
            Paste your {provider.label} API key. Requests go straight from this browser to {provider.label}, with your
            diagram and your messages; Wireflow has no server and never sees them.
          </p>
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={provider.keyHint}
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveKey()}
            aria-label="API key"
            className="ai-key-input rounded-md border border-wire-border px-3 py-2 text-sm outline-none focus:border-wire-blue"
          />
          <div className="flex items-start gap-2">
            <input
              id="ai-remember"
              type="checkbox"
              checked={remember && !!canStore}
              disabled={!canStore}
              onChange={(e) => setRemember(e.target.checked)}
              aria-describedby="ai-remember-note"
              className="mt-1"
            />
            <div>
              <label htmlFor="ai-remember" className={canStore ? "font-semibold" : "font-semibold text-ink-soft"}>
                Remember on this device
              </label>
              {canStore ? (
                <p id="ai-remember-note" className="text-ink-soft">
                  Stored encrypted in this browser, so the key never shows as plain text in its storage or in a copy of
                  it. Code running on this page, a browser extension or someone using this browser profile could still
                  use it. Unticked, the key stays in memory until you close or reload the tab.
                </p>
              ) : (
                <p id="ai-remember-note" className="text-ink-soft">
                  This browser doesn&apos;t let Wireflow keep data here (a private window, or site data blocked?), so
                  the key can&apos;t be remembered. It stays in memory until you close or reload the tab.
                </p>
              )}
            </div>
          </div>
          {keyError && (
            <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-rose-800 ring-1 ring-rose-200">
              {keyError}
            </p>
          )}
          <button
            onClick={saveKey}
            disabled={!keyDraft.trim() || checkingKey}
            className={`${button} self-start bg-wire-blue text-white hover:bg-wire-blue-dark`}
          >
            {checkingKey ? "Checking…" : "Check & use key"}
          </button>
          <p className="text-ink-soft">
            Tip: use a dedicated key with an expiry and a spend limit.{" "}
            <a
              href={provider.keyUrl}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-wire-blue hover:underline"
            >
              Create a key
            </a>
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            {!messages.length && (
              <p className="text-xs leading-5 text-ink-soft">
                Describe a flow to build (&quot;a sign-up flow with email verification&quot;) or a change to make
                (&quot;rename the selected screen to Basket and connect it to Checkout&quot;).
              </p>
            )}
            {messages.map((m) =>
              m.role === "user" ? (
                <div
                  key={m.id}
                  className="max-w-[85%] self-end whitespace-pre-wrap break-words rounded-lg bg-wire-lavender px-3 py-1.5 text-xs leading-5 text-ink"
                >
                  {m.text}
                </div>
              ) : (
                <div
                  key={m.id}
                  data-status={m.status}
                  className="ai-msg flex flex-col gap-1.5 whitespace-pre-wrap break-words text-xs leading-5 text-ink"
                >
                  {m.thinking && (
                    <details className="text-[11px] text-ink-soft">
                      <summary className="cursor-pointer">Thinking</summary>
                      {m.thinking}
                    </details>
                  )}
                  {m.status === "streaming" && !m.text && <p className="text-ink-soft">Thinking…</p>}
                  {m.text && <div>{m.text}</div>}
                  {m.applied.map((a, i) => {
                    const state = a.step === null ? "applied" : stepState(history, a.step);
                    const summary = a.summary || `${a.count} changes`;
                    return (
                      <div
                        key={i}
                        data-state={state}
                        className="flex items-center justify-between gap-2 whitespace-normal rounded-md bg-emerald-50 py-0.5 pl-2 pr-1 text-[11px] ring-1 ring-emerald-200"
                      >
                        <span>
                          {STATE_PREFIX[state]}
                          {summary}
                        </span>
                        {state === "latest" && (
                          // Only the latest change: undoing an older one would undo what came after it too.
                          <button
                            onClick={store.undo}
                            disabled={busy}
                            aria-label={`Undo: ${summary}`}
                            className={`${link} px-1`}
                          >
                            Undo
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {statusNote(m) && (
                    <p className="rounded-md bg-amber-50 px-2 py-1 text-amber-900 ring-1 ring-amber-200">
                      {statusNote(m)}
                    </p>
                  )}
                  {m.status === "aborted" && <p className="text-ink-soft">Stopped.</p>}
                  {m.status === "error" && (
                    <div
                      role="alert"
                      className="flex items-center justify-between gap-2 rounded-md bg-rose-50 px-2 py-1 text-rose-800 ring-1 ring-rose-200"
                    >
                      <span>{m.error}</span>
                      {m.errorKind === "auth" && (
                        <button onClick={forgetKey} className={link}>
                          Change key
                        </button>
                      )}
                    </div>
                  )}
                  {m.cost !== undefined && <p className="text-[10px] text-ink-soft/70">{money(m.cost)}</p>}
                </div>
              )
            )}
            <div ref={listEnd} />
          </div>
          <p className="sr-only" role="status">
            {announcement}
          </p>
          <div className="flex items-end gap-2 border-t border-wire-border px-4 py-3">
            <textarea
              ref={composer}
              rows={2}
              placeholder="Ask for a flow or a change…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                }
              }}
              aria-label="Message"
              className="max-h-40 min-h-[3rem] flex-1 resize-y rounded-md border border-wire-border px-3 py-2 text-xs leading-5 outline-none focus:border-wire-blue"
            />
            {busy ? (
              <button
                onClick={() => abort.current?.abort()}
                className={`${button} flex items-center gap-1.5 bg-rose-50 text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100`}
              >
                <Square size={12} aria-hidden />
                Stop
              </button>
            ) : (
              <button
                onClick={() => void send()}
                disabled={!draft.trim()}
                className={`${button} flex items-center gap-1.5 bg-wire-blue text-white hover:bg-wire-blue-dark`}
              >
                <Send size={12} aria-hidden />
                Send
              </button>
            )}
          </div>
          {canStore && (
            <label className="flex items-center gap-1.5 self-start px-4 pb-1 text-[11px] text-ink-soft">
              <input type="checkbox" checked={keepChat} onChange={(e) => changeKeepChat(e.target.checked)} />
              Keep chat after reload
            </label>
          )}
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-4 pb-2 text-[11px] text-ink-soft">
            <span className="whitespace-nowrap">{money(sessionCost)} this session</span>
            <span className="flex items-center gap-2 whitespace-nowrap">
              <span
                className="ai-masked-key flex items-center gap-1 font-mono"
                title={remembered ? "Remembered on this device, encrypted" : "In memory until the tab closes"}
              >
                {remembered && <Lock size={10} aria-hidden />}
                {maskKey(apiKey)}
              </span>
              {remembered && <span className="sr-only">Remembered on this device, encrypted.</span>}
              <button onClick={forgetKey} className={link}>
                Forget key
              </button>
              <button onClick={newChat} disabled={busy || !messages.length} className={link}>
                New chat
              </button>
            </span>
          </div>
        </>
      )}
    </aside>
  );
}
