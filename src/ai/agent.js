import { EDIT_DIAGRAM_TOOL, planOps } from './diagram';

const MAX_STEPS = 6;

export const TOOLS = [EDIT_DIAGRAM_TOOL];

const diagramBlock = (snap) => `<diagram>${JSON.stringify(snap)}</diagram>`;

/**
 * Run one user request to completion: send, apply tool calls, send results, repeat.
 * Provider-neutral; `chat` comes from provider.createChat().
 *
 * editor: { read() -> {data, selected}, apply(actions) -> data, snapshot(data, selected) }
 * onEvent({ type: 'text' | 'thinking' | 'applied' | 'tool_error' | 'step', ... })
 * Returns { status, usage: {usd, ...} } with usage summed over all steps.
 */
export async function runRequest({ chat, text, editor, onEvent = () => {}, signal }) {
  const total = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, usd: 0 };
  const add = (u) => Object.keys(total).forEach((k) => (total[k] += u[k] ?? 0));

  const { data, selected } = editor.read();
  let input = { text: [text, diagramBlock(editor.snapshot(data, selected))] };

  for (let step = 0; step < MAX_STEPS; step++) {
    onEvent({ type: 'step', step });
    const turn = await chat.send(input, {
      signal,
      onText: (delta) => onEvent({ type: 'text', delta }),
      onThinking: (delta) => onEvent({ type: 'thinking', delta }),
    });
    add(turn.usage);

    if (turn.status !== 'tool_use') return { status: turn.status, refusal: turn.refusal, usage: total };
    // Out of steps: leave these calls unapplied (the provider reports them as such next time).
    if (step === MAX_STEPS - 1) break;

    // Validate every call against the live diagram at apply time (the user may
    // have edited it while the model was thinking), then apply it as one undo step.
    const results = turn.toolCalls.map((call) => {
      if (call.name !== EDIT_DIAGRAM_TOOL.name) {
        return { id: call.id, isError: true, content: `Unknown tool ${call.name}` };
      }
      const live = editor.read();
      const plan = planOps(call.input, live.data);
      if (plan.errors) {
        onEvent({ type: 'tool_error', errors: plan.errors });
        return {
          id: call.id,
          isError: true,
          content: JSON.stringify({ ok: false, applied: 0, errors: plan.errors, diagram: editor.snapshot(live.data, live.selected) }),
        };
      }
      try {
        editor.apply(plan.actions);
      } catch (err) {
        onEvent({ type: 'tool_error', errors: [{ index: -1, op: null, message: err.message }] });
        return { id: call.id, isError: true, content: JSON.stringify({ ok: false, applied: 0, errors: [{ message: `Editor error: ${err.message}` }] }) };
      }
      onEvent({ type: 'applied', count: plan.actions.length, summary: plan.summary });
      return {
        id: call.id,
        content: JSON.stringify({ ok: true, applied: plan.actions.length, ...(Object.keys(plan.placed).length ? { placed: plan.placed } : {}) }),
      };
    });

    input = { toolResults: results };
  }
  return { status: 'step_limit', usage: total };
}
