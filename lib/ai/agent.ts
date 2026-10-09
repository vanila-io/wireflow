// The agent loop (#105), provider-neutral: send, apply tool calls, send results, repeat.
import type { Diagram } from '@/lib/diagram/model';
import { EDIT_DIAGRAM_TOOL, planOps, snapshot, type Action, type View } from './diagram';
import type { Chat, ToolResult, Usage } from './providers/types';

const MAX_STEPS = 6;

export const TOOLS = [EDIT_DIAGRAM_TOOL];

export type EditorView = { data: Diagram; selected: string[]; view?: View };
/** What the agent needs from the editor: read the live diagram, apply a plan as one undo step. */
export type AgentEditor = { read(): EditorView; apply(actions: Action[]): void };

export type AgentEvent =
  | { type: 'step'; step: number }
  | { type: 'text'; delta: string }
  | { type: 'thinking'; delta: string }
  | { type: 'usage'; usage: Usage }
  | { type: 'applied'; count: number; summary: string }
  | { type: 'tool_error'; errors: unknown[] };

export type Result = { status: 'done' | 'refused' | 'truncated' | 'step_limit'; refusal?: string | null; usage: Usage };

const diagramBlock = (state: EditorView) => `<diagram>${JSON.stringify(snapshot(state))}</diagram>`;

/**
 * Run one user request to completion. 'usage' events arrive after every model
 * call, so the cost of finished steps is known even if a later step fails or is
 * stopped. Returns the status and the usage summed over all steps.
 */
export async function runRequest({
  chat,
  text,
  editor,
  onEvent = () => {},
  signal,
}: {
  chat: Chat;
  text: string;
  editor: AgentEditor;
  onEvent?: (e: AgentEvent) => void;
  signal?: AbortSignal;
}): Promise<Result> {
  const total: Usage = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, usd: 0 };
  let input: { text?: string[]; toolResults?: ToolResult[] } = { text: [text, diagramBlock(editor.read())] };

  for (let step = 0; step < MAX_STEPS; step++) {
    onEvent({ type: 'step', step });
    const turn = await chat.send(input, {
      signal,
      onText: (delta) => onEvent({ type: 'text', delta }),
      onThinking: (delta) => onEvent({ type: 'thinking', delta }),
    });
    for (const k of Object.keys(total) as (keyof Usage)[]) total[k] += turn.usage[k] ?? 0;
    onEvent({ type: 'usage', usage: turn.usage });

    if (turn.status !== 'tool_use') return { status: turn.status, refusal: turn.refusal, usage: total };
    // Out of steps: leave these calls unapplied (the provider reports them as such next time).
    if (step === MAX_STEPS - 1) break;

    // Validate every call against the live diagram at apply time (the user may
    // have edited it while the model was thinking), then apply it as one undo step.
    const results: ToolResult[] = turn.toolCalls.map((call) => {
      if (call.name !== EDIT_DIAGRAM_TOOL.name) return { id: call.id, isError: true, content: `Unknown tool ${call.name}` };
      const live = editor.read();
      const plan = planOps(call.input, live.data);
      if (plan.errors) {
        onEvent({ type: 'tool_error', errors: plan.errors });
        return { id: call.id, isError: true, content: JSON.stringify({ ok: false, applied: 0, errors: plan.errors, diagram: snapshot(live) }) };
      }
      try {
        editor.apply(plan.actions);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        onEvent({ type: 'tool_error', errors: [{ index: -1, op: null, message }] });
        return { id: call.id, isError: true, content: JSON.stringify({ ok: false, applied: 0, errors: [{ message: `Editor error: ${message}` }] }) };
      }
      const applied = (call.input as { operations: unknown[] }).operations.length;
      onEvent({ type: 'applied', count: applied, summary: plan.summary });
      return {
        id: call.id,
        content: JSON.stringify({
          ok: true,
          applied,
          ...(Object.keys(plan.placed).length ? { placed: plan.placed } : {}),
          ...(plan.warnings.length ? { warnings: plan.warnings } : {}),
        }),
      };
    });

    input = { toolResults: results };
  }
  return { status: 'step_limit', usage: total };
}
