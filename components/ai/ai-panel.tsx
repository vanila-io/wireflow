"use client";
// The AI assistant (#105): bring your own key, the browser talks straight to the
// provider. Loaded on first open (see use-ai-panel.tsx). Model output is shown as
// plain text only.
import { useEffect, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { Send, Sparkles, Square, X } from "lucide-react";
import { runRequest, TOOLS, type AgentEditor } from "@/lib/ai/agent";
import { applyActions } from "@/lib/ai/diagram";
import { systemPrompt } from "@/lib/ai/prompt";
import { getProvider, providers } from "@/lib/ai/providers";
import type { AiErrorKind, Chat } from "@/lib/ai/providers/types";
import { stepState } from "@/lib/diagram/history";
import { useStore, useStoreState } from "../editor/store-context";

export type AiPanelProps = { open: boolean; onClose: () => void };

const SETTINGS = "wireflow-ai";
type Settings = { provider?: string; model?: string; apiKey?: string };

// Remembered settings live in this browser only. The key is stored only when the
// user ticks "Remember on this device", and then unencrypted.
function loadSettings(): Settings {
  try {
    const v = JSON.parse(localStorage.getItem(SETTINGS) ?? "null");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}
function storeSettings(settings: Settings) {
  try {
    localStorage.setItem(SETTINGS, JSON.stringify(settings));
  } catch {
    // Storage blocked: the settings just won't be remembered.
  }
}

const money = (usd: number) => `$${usd < 0.01 ? usd.toFixed(4) : usd.toFixed(3)}`;
const maskKey = (key: string) => `${key.slice(0, 7)}…${key.slice(-4)}`;

type Applied = { count: number; summary: string; step: number | null };
type Message =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "assistant";
      text: string;
      thinking: string;
      applied: Applied[];
      status: "streaming" | "done" | "refused" | "truncated" | "step_limit" | "aborted" | "error";
      refusal?: string | null;
      error?: string;
      errorKind?: AiErrorKind;
      cost?: number;
    };
type AssistantMessage = Extract<Message, { role: "assistant" }>;

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

  const [saved] = useState(loadSettings);
  const [providerId, setProviderId] = useState(saved.provider ?? providers[0].id);
  const provider = getProvider(providerId);
  const [model, setModel] = useState(
    provider.models.some((m) => m.id === saved.model) ? saved.model! : provider.defaultModel
  );
  const [apiKey, setApiKey] = useState<string | null>(saved.apiKey ?? null);
  const [keyDraft, setKeyDraft] = useState("");
  const [remember, setRemember] = useState(!!saved.apiKey);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [checkingKey, setCheckingKey] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionCost, setSessionCost] = useState(0);

  const chat = useRef<Chat | null>(null);
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

  const newChat = () => {
    abort.current?.abort();
    chat.current = null;
    setMessages([]);
  };

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

    chat.current ??= provider.createChat({ apiKey, model, system: systemPrompt(), tools: TOOLS });
    const controller = new AbortController();
    abort.current = controller;
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
          if (e.type === "step" && e.step > 0) gap = true;
          if (e.type === "text") {
            const sep = gap ? "\n\n" : "";
            gap = false;
            update(id, (m) => ({ ...m, text: m.text ? m.text + sep + e.delta : e.delta }));
          }
          if (e.type === "thinking") update(id, (m) => ({ ...m, thinking: m.thinking + e.delta }));
          if (e.type === "usage") {
            update(id, (m) => ({ ...m, cost: (m.cost ?? 0) + e.usage.usd }));
            setSessionCost((c) => c + e.usage.usd);
          }
          if (e.type === "applied") {
            const step = lastStep;
            update(id, (m) => ({ ...m, applied: [...m.applied, { count: e.count, summary: e.summary, step }] }));
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
      setApiKey(key);
      setKeyDraft("");
      chat.current = null;
      storeSettings({ provider: providerId, model, ...(remember ? { apiKey: key } : {}) });
    } catch (err) {
      setKeyError((err as Error).message);
    } finally {
      setCheckingKey(false);
    }
  }

  function forgetKey() {
    newChat();
    setApiKey(null);
    storeSettings({ provider: providerId, model });
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
            storeSettings({ provider: providerId, model: e.target.value, ...(remember && apiKey ? { apiKey } : {}) });
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

      {!apiKey ? (
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
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="mt-1"
            />
            <span>
              Remember on this device. <strong>It is stored unencrypted</strong> in this browser&apos;s storage.
              Unticked, the key stays in memory and is gone when you close or reload the tab.
            </span>
          </label>
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
          <div className="flex items-center justify-between gap-2 px-4 pb-2 text-[11px] text-ink-soft">
            <span>{money(sessionCost)} this session</span>
            <span className="flex items-center gap-2">
              <span className="ai-masked-key font-mono">{maskKey(apiKey)}</span>
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
