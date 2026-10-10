"use client";
// The AI panel and the Anthropic SDK are a separate chunk that loads on first
// open. A failed load (offline, or a newer version was deployed) leaves the
// editor working and says so on the button. Next.js 16.2's Turbopack runtime
// remembers a chunk that failed to load for the life of the page, so trying
// again needs a reload; the message says that. An error inside the panel
// closes only the panel.
import { Component, useCallback, useState, type ComponentType, type ReactNode } from "react";
import type { AiPanelProps } from "./ai-panel";

export const LOAD_FAILED = "Couldn't load the AI assistant. Check the connection, then reload the page to try again.";

export function useAiPanel() {
  const [Panel, setPanel] = useState<ComponentType<AiPanelProps> | null>(null);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  const toggle = useCallback(async () => {
    if (Panel) return setOpen((o) => !o);
    try {
      const { default: AiPanel } = await import("./ai-panel");
      setPanel(() => AiPanel);
      setFailed(false);
      setOpen(true);
    } catch {
      setFailed(true);
    }
  }, [Panel]);

  return { Panel, open, failed, toggle, close: useCallback(() => setOpen(false), []) };
}

export class PanelBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  render() {
    if (!this.state.crashed) return this.props.children;
    return (
      <p
        role="alert"
        className="absolute bottom-20 right-4 z-30 max-w-xs rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800 shadow-lg ring-1 ring-rose-200"
      >
        The AI assistant stopped working. Your diagram is fine; reload the page to use the assistant again.
      </p>
    );
  }
}
