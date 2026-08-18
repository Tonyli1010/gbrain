import { describe, expect, test } from 'bun:test';
import {
  AIConfigError,
  AITransientError,
  normalizeAIError,
} from '../../src/core/ai/errors.ts';

describe('normalizeAIError', () => {
  test('classifies status-less provider access denial as config error', () => {
    const err = normalizeAIError(
      new Error('Access to model denied. Please make sure you are eligible for using the model.'),
      'chat(dashscope:qwen3.7-plus)',
    );
    expect(err).toBeInstanceOf(AIConfigError);
  });

  test('keeps an ambiguous network failure transient', () => {
    expect(normalizeAIError(new Error('socket closed'))).toBeInstanceOf(AITransientError);
  });
});
