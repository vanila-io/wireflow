import anthropic from './anthropic';
import type { Provider } from './types';

// Every provider implements the interface in ./types.ts.
export const providers: Provider[] = [anthropic];

export const getProvider = (id: string) => providers.find((p) => p.id === id) ?? providers[0];
