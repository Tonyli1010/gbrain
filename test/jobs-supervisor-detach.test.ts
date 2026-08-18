import { describe, expect, test } from 'bun:test';
import { DETACHED_SUPERVISOR_STDIO } from '../src/commands/jobs.ts';

describe('jobs supervisor --detach', () => {
  test('does not inherit launcher-owned stdio pipes', () => {
    expect(DETACHED_SUPERVISOR_STDIO).toEqual(['ignore', 'ignore', 'ignore']);
  });
});
