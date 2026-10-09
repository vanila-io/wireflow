import anthropic from './anthropic';

/**
 * AI providers. Each one implements:
 *
 *   id, label, keyHint, keyUrl
 *   models: [{ id, label, price: { input, output, cacheWrite, cacheRead } }]  (USD per MTok)
 *   defaultModel
 *   validateKey({ apiKey, model }) -> Promise<void>, throws AiError
 *   createChat({ apiKey, model, system, tools }) -> { send }
 *
 * `tools` are provider-neutral: [{ name, description, parameters: JSONSchema }].
 * The chat keeps its own history in whatever format the provider needs.
 *
 *   send({ text?: string[], toolResults?: [{ id, content, isError }] },
 *        { onText?, onThinking?, signal? })
 *     -> { status: 'done' | 'tool_use' | 'refused' | 'truncated',
 *          text, toolCalls: [{ id, name, input }], refusal, model,
 *          usage: { input, output, cacheWrite, cacheRead, usd } }
 *     throws AiError
 *
 * A request joins the history only once it is answered: after a stop, an error or a
 * refusal, the next send continues from the last answered turn. Tool calls that were
 * never answered are closed out by the provider on the next send (the agent may stop
 * between steps), and tool results it could not deliver are sent again.
 */
export const providers = [anthropic];

export const getProvider = (id) => providers.find((p) => p.id === id) ?? providers[0];
