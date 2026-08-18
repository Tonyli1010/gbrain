/**
 * Correctness-gate regressions for the atom backlog/drain + Doctor authority.
 *
 * These cases pin three contracts that must agree end-to-end:
 *  - a brain-wide doctor count emits source-explicit drain commands;
 *  - the drain window is an absolute deadline for each in-flight model call;
 *  - Doctor/onboard honors home config when no DB override exists.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGLiteEngine } from '../src/core/pglite-engine.ts';
import { resetPgliteState } from './helpers/reset-pglite.ts';
import { withEnv } from './helpers/with-env.ts';
import { computeExtractAtomsBacklogCheck } from '../src/commands/doctor.ts';
import { runExtractAtomsDrain } from '../src/core/cycle/extract-atoms-drain.ts';
import { runPhaseExtractAtoms } from '../src/core/cycle/extract-atoms.ts';
import { checkPackUpgradeAvailable } from '../src/core/onboard/checks.ts';
import type { ChatOpts, ChatResult } from '../src/core/ai/gateway.ts';

let engine: PGLiteEngine;
const EMPTY_HOME = mkdtempSync(join(tmpdir(), 'gbrain-correctness-home-'));
const V2_HOME = mkdtempSync(join(tmpdir(), 'gbrain-correctness-v2-home-'));
const BODY = 'x'.repeat(600);

beforeAll(async () => {
  mkdirSync(join(V2_HOME, '.gbrain'), { recursive: true });
  writeFileSync(
    join(V2_HOME, '.gbrain', 'config.json'),
    JSON.stringify({ engine: 'pglite', schema_pack: 'gbrain-base-v2' }),
  );
  engine = new PGLiteEngine();
  await engine.connect({});
  await engine.initSchema();
});

afterAll(async () => {
  await engine.disconnect();
  rmSync(EMPTY_HOME, { recursive: true, force: true });
  rmSync(V2_HOME, { recursive: true, force: true });
});

beforeEach(async () => {
  await resetPgliteState(engine);
});

async function seedArticle(slug: string, sourceId = 'default'): Promise<void> {
  await engine.putPage(slug, {
    type: 'article',
    title: slug,
    compiled_truth: BODY,
  }, { sourceId });
}

describe('doctor atom backlog routing', () => {
  it('turns a brain-wide count into source-explicit commands', async () => {
    await engine.executeRaw(
      `INSERT INTO sources (id, name) VALUES ('zeus', 'Zeus') ON CONFLICT DO NOTHING`,
    );
    for (let i = 0; i < 11; i++) await seedArticle(`default-${i}`);
    for (let i = 0; i < 2; i++) await seedArticle(`zeus-${i}`, 'zeus');

    const check = await withEnv({ GBRAIN_HOME: EMPTY_HOME }, () =>
      computeExtractAtomsBacklogCheck(engine));

    expect(check.status).toBe('warn');
    expect(check.message).toContain('--source default');
    expect(check.message).toContain('--source zeus');
    expect(check.message).not.toContain('--window 120 (or declare');
    expect(check.details).toMatchObject({
      backlog: 13,
      source_backlogs: [
        { source_id: 'default', backlog: 11 },
        { source_id: 'zeus', backlog: 2 },
      ],
    });
  });
});

describe('extract_atoms hard window', () => {
  it('classifies a batch that reaches its absolute deadline as stopped=window', async () => {
    const result = await runExtractAtomsDrain(
      {
        withLock: (work) => work(),
        runBatch: async () => ({
          extracted: 0,
          skipped: 0,
          windowExpired: true,
        }),
        countRemaining: async () => 1,
        now: () => 0,
      },
      { windowMs: 1_000 },
    );

    expect(result.status).toBe('ok');
    expect(result.stopped).toBe('window');
    expect(result.remaining).toBe(1);
  });

  it('aborts an in-flight model call at the per-run deadline', async () => {
    let receivedSignal: AbortSignal | undefined;
    const hangingChat = async (opts: ChatOpts): Promise<ChatResult> => {
      receivedSignal = opts.abortSignal;
      return await new Promise<ChatResult>((_resolve, reject) => {
        if (!opts.abortSignal) {
          reject(new Error('missing abort signal'));
          return;
        }
        const rejectAborted = () => reject(
          opts.abortSignal?.reason instanceof Error
            ? opts.abortSignal.reason
            : new Error('deadline aborted'),
        );
        if (opts.abortSignal.aborted) rejectAborted();
        else opts.abortSignal.addEventListener('abort', rejectAborted, { once: true });
      });
    };

    const started = Date.now();
    const result = await runPhaseExtractAtoms(engine, {
      sourceId: 'default',
      dryRun: true,
      _transcripts: [],
      _pages: [{ slug: 'slow-page', content: BODY, contentHash: 'a'.repeat(64) }],
      _chat: hangingChat,
      deadlineAtMs: started + 40,
    });
    const elapsed = Date.now() - started;
    const details = result.details as Record<string, unknown>;

    expect(receivedSignal).toBeDefined();
    expect(elapsed).toBeLessThan(500);
    expect(details.deadline_reached).toBe(true);
    expect(details.failures).toEqual([]);
  });
});

describe('Doctor pack authority', () => {
  it('uses home-config v2 when the DB override is unset', async () => {
    expect(await engine.getConfig('schema_pack')).toBeNull();
    const result = await withEnv(
      { GBRAIN_HOME: V2_HOME, GBRAIN_SCHEMA_PACK: undefined },
      () => checkPackUpgradeAvailable(engine),
    );

    expect(result.check.status).toBe('ok');
    expect(result.check.message).toContain('gbrain-base-v2@');
    expect(result.check.message).toContain('current');
    expect(result.remediations).toEqual([]);
  });
});
