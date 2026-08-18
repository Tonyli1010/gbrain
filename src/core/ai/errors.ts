/**
 * AI service error hierarchy. Three classes mapping to caller decisions:
 *
 *   AIConfigError     — user fixes: bad key, missing model, dim mismatch.
 *                       Abort + show recovery recipe.
 *   AITransientError  — retryable: SDK retries exhausted, rate limit sustained.
 *                       Propagate so job queue can retry later.
 *   AIServiceError    — base class for both.
 *
 * The `fix` field carries a human-readable recovery recipe agents and humans
 * can act on. The `cause` field preserves the underlying SDK error.
 */

export class AIServiceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'AIServiceError';
  }
}

export class AIConfigError extends AIServiceError {
  constructor(
    message: string,
    public readonly fix?: string,
    cause?: unknown,
  ) {
    super(message, cause);
    this.name = 'AIConfigError';
  }
}

export class AITransientError extends AIServiceError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'AITransientError';
  }
}

/**
 * Provider rejections that happen before inference and are therefore both
 * non-retryable and non-billable when the error carries no usage payload.
 * Some OpenAI-compatible providers omit the HTTP status from their SDK error,
 * so retain a narrow message fallback for explicit access/auth denials.
 */
export function isProviderConfigRejection(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const candidate = err as {
    status?: unknown;
    statusCode?: unknown;
    message?: unknown;
    response?: { status?: unknown };
  };
  const status = candidate.status ?? candidate.statusCode ?? candidate.response?.status;
  if (typeof status === 'number' && status >= 400 && status < 500 && status !== 429) {
    return true;
  }
  const message = typeof candidate.message === 'string' ? candidate.message : '';
  return /access to model denied|eligible for using the model|invalid api key|unauthori[sz]ed|forbidden/i.test(message);
}

/**
 * Normalize any thrown error into our hierarchy. AI SDK errors are inspected
 * by status code + name; unknown errors default to AITransientError so the
 * caller does not permanently abort on a transient network blip.
 */
export function normalizeAIError(err: unknown, context?: string): AIServiceError {
  if (err instanceof AIServiceError) return err;

  const anyErr = err as { name?: string; status?: number; statusCode?: number; message?: string };
  const status = anyErr?.status ?? anyErr?.statusCode;
  const name = anyErr?.name ?? '';
  const msg = anyErr?.message ?? String(err);
  const ctxPrefix = context ? `[${context}] ` : '';

  // 4xx (except 429) = config-level, non-retryable
  if (typeof status === 'number' && status >= 400 && status < 500 && status !== 429) {
    return new AIConfigError(
      `${ctxPrefix}${msg}`,
      status === 401 || status === 403
        ? 'Check your API key is valid and has access to this model.'
        : 'Check your model id + provider options match the provider API.',
      err,
    );
  }

  // AI SDK named errors
  if (name === 'LoadAPIKeyError' || name === 'InvalidArgumentError') {
    return new AIConfigError(`${ctxPrefix}${msg}`, undefined, err);
  }

  // Some OpenAI-compatible providers (observed with DashScope model-access
  // denial) drop the HTTP status before the error reaches this boundary.
  if (isProviderConfigRejection(err)) {
    return new AIConfigError(
      `${ctxPrefix}${msg}`,
      'Check your API key is valid and has access to this model.',
      err,
    );
  }

  // Everything else (5xx, timeouts, network) = transient
  return new AITransientError(`${ctxPrefix}${msg}`, err);
}
