// Provider-neutral error. `kind` is one of: auth, permission, rate_limit,
// overloaded, network, bad_request, aborted, unknown.
export class AiError extends Error {
  constructor(kind, message, cause) {
    super(message, { cause });
    this.name = 'AiError';
    this.kind = kind;
  }
}
