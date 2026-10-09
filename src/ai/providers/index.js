import anthropic from './anthropic';

/**
 * AI providers. Each one implements:
 *
 *   id, label, keyHint, keyUrl
 *   models: [{ id, label, price: { input, output, cacheWrite, cacheRead } }]  (USD per MTok)
 *   defaultModel
 *   validateKey({ apiKey, model, baseURL? }) -> Promise<void>, throws AiError
 *   createChat({ apiKey, model, system, tools, baseURL? }) -> { send }
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
 * Tool calls a provider returned but that were never answered must be closed out
 * by the provider on the next send (the agent may stop between steps).
 */
export const providers = [anthropic];

export const getProvider = (id) => providers.find((p) => p.id === id) ?? providers[0];
