import assert from 'assert';
import { prisma } from '../src/lib/db';
import { encryptApiKey } from '../src/lib/ai-router/crypto';
import { generateWithRouter } from '../src/lib/ai-router/router';
import { runCheckpointedJob } from '../src/lib/ai-router/checkpoint';
import { ProviderHttpError, TransportHandler } from '../src/lib/ai-router/types';

async function main() {
  const tag = `failover-test-${Date.now()}`;
  const createdKeyIds: string[] = [];
  let createdJobId: string | undefined;

  try {
    // Disable existing real keys temporarily only in memory? No — give synthetic keys highest priority (1, 2)
    // and test with a custom mock transport so real keys are untouched!
    const k1 = encryptApiKey(`${tag}-gemini-key-1-000000000000`);
    const k2 = encryptApiKey(`${tag}-groq-key-2-000000000000`);

    const rec1 = await prisma.apiKeyRecord.create({
      data: {
        label: `${tag}-key1`,
        provider: 'GEMINI',
        encryptedKey: k1.encryptedKey,
        iv: k1.iv,
        authTag: k1.authTag,
        keyHash: k1.keyHash,
        maskedKey: k1.maskedKey,
        defaultModel: 'gemini-3.8-flash',
        enabled: true,
        priority: 1,
        capabilitiesJson: JSON.stringify({ text: true, vision: true, long_context: true, json: true }),
        status: 'HEALTHY',
      },
    });
    createdKeyIds.push(rec1.id);

    const rec2 = await prisma.apiKeyRecord.create({
      data: {
        label: `${tag}-key2`,
        provider: 'GROQ',
        encryptedKey: k2.encryptedKey,
        iv: k2.iv,
        authTag: k2.authTag,
        keyHash: k2.keyHash,
        maskedKey: k2.maskedKey,
        defaultModel: 'openai/gpt-oss-120b',
        enabled: true,
        priority: 2,
        capabilitiesJson: JSON.stringify({ text: true, vision: false, long_context: false, json: true }),
        status: 'HEALTHY',
      },
    });
    createdKeyIds.push(rec2.id);

    // Disable real keys temporarily so Step 1 & Step 2 only touch synthetic keys
    await prisma.apiKeyRecord.updateMany({
      where: { id: { notIn: createdKeyIds } },
      data: { enabled: false },
    });

    // 1. Test 429 Cooldown Failover: Key 1 returns 429 on every Gemini model -> seamless failover to Key 2 (GROQ)
    let callCount = 0;
    const mockTransport1: TransportHandler = async (_provider, keyId, params) => {
      callCount++;
      if (keyId === rec1.id) {
        throw new ProviderHttpError({
          status: 429,
          message: 'Rate limit exceeded (RPM)',
          retryAfterSeconds: 45,
        });
      }
      if (keyId === rec2.id) {
        return `GROQ_RESCUED:${params.model}`;
      }
      throw new ProviderHttpError({ status: 429, message: 'Unexpected other key' });
    };

    const res1 = await generateWithRouter(
      {
        taskType: 'fast_generation',
        preferredProvider: 'GEMINI',
        prompt: 'Step 1 test prompt',
      },
      { transport: mockTransport1 }
    );

    assert.strictEqual(res1.provider, 'GROQ', 'Expected failover to GROQ key');
    assert.ok(res1.failovers >= 1, 'Expected failover counter >= 1');

    const updatedRec1 = await prisma.apiKeyRecord.findUniqueOrThrow({ where: { id: rec1.id } });
    assert.strictEqual(updatedRec1.status, 'COOLDOWN', 'Expected Key 1 marked COOLDOWN after 429 across models');

    // 2. Test Checkpointed Job: Step 1 completes on Key 2, Step 2 exhausts ALL keys -> PAUSED_QUOTA -> Recover Key 1 -> Resume & Complete

    const jobTransportExhaust: TransportHandler = async (_provider, keyId, params) => {
      if (params.prompt.includes('STEP_ONE')) {
        return `STEP_ONE_OK:${keyId}`;
      }
      throw new ProviderHttpError({
        status: 429,
        message: 'Daily RPD limit reached',
        retryAfterSeconds: 3600,
      });
    };

    interface TestState extends Record<string, unknown> {
      step1?: string;
      step2?: string;
    }

    const paused = await runCheckpointedJob<TestState>({
      moduleType: 'TEST_FAILOVER',
      title: `${tag}-job`,
      initialState: {},
      transport: jobTransportExhaust,
      steps: [
        {
          name: 'Step 1',
          run: async (st, ctx) => {
            const r = await generateWithRouter(
              { taskType: 'fast_generation', prompt: 'STEP_ONE', jobId: ctx.jobId },
              { transport: ctx.transport }
            );
            return { ...st, step1: r.text };
          },
        },
        {
          name: 'Step 2',
          run: async (st, ctx) => {
            const r = await generateWithRouter(
              { taskType: 'fast_generation', prompt: 'STEP_TWO', jobId: ctx.jobId },
              { transport: ctx.transport }
            );
            return { ...st, step2: r.text };
          },
        },
      ],
    });

    createdJobId = paused.jobId;
    assert.strictEqual(paused.status, 'PAUSED_QUOTA', 'Expected job to pause cleanly as PAUSED_QUOTA');
    assert.strictEqual(paused.completedSteps, 1, 'Expected step 1 checkpoint preserved');
    assert.ok(paused.zeroKeyRemainingPrompt?.includes('Step 2'), 'Expected remaining prompt for step 2 only');

    // Re-enable Key 1 as healthy & resume same job from checkpoint
    await prisma.apiKeyRecord.update({
      where: { id: rec1.id },
      data: { status: 'HEALTHY', cooldownUntil: null, exhaustedUntil: null, modelHealthJson: '{}' },
    });

    const resumed = await runCheckpointedJob<TestState>({
      existingJobId: paused.jobId,
      moduleType: 'TEST_FAILOVER',
      title: `${tag}-job`,
      initialState: {},
      transport: async () => 'STEP_TWO_RESUMED_OK',
      steps: [
        {
          name: 'Step 1',
          run: async () => {
            throw new Error('Step 1 should NOT re-run when resuming from checkpoint!');
          },
        },
        {
          name: 'Step 2',
          run: async (st, ctx) => {
            const r = await generateWithRouter(
              { taskType: 'fast_generation', prompt: 'STEP_TWO', jobId: ctx.jobId },
              { transport: ctx.transport }
            );
            return { ...st, step2: r.text };
          },
        },
      ],
    });

    assert.strictEqual(resumed.status, 'COMPLETED', 'Expected resumed job to complete');
    assert.strictEqual(resumed.completedSteps, 2, 'Expected 2/2 steps completed');
    assert.ok(resumed.state.step1?.startsWith('STEP_ONE_OK'), 'Expected step 1 output preserved');
    assert.strictEqual(resumed.state.step2, 'STEP_TWO_RESUMED_OK', 'Expected step 2 completed after resume');

    console.log(
      JSON.stringify(
        {
          ok: true,
          failoverCalls: callCount,
          pausedAtStep: paused.completedSteps,
          resumedStatus: resumed.status,
          preservedStep1: resumed.state.step1,
          completedStep2: resumed.state.step2,
        },
        null,
        2
      )
    );
  } finally {
    // Re-enable real keys and clean up synthetic test records
    await prisma.apiKeyRecord.updateMany({
      where: { id: { notIn: createdKeyIds } },
      data: { enabled: true },
    });
    if (createdKeyIds.length) {
      await prisma.apiKeyRecord.deleteMany({ where: { id: { in: createdKeyIds } } });
    }
    if (createdJobId) {
      await prisma.failoverLog.deleteMany({ where: { jobId: createdJobId } });
      await prisma.generationJob.deleteMany({ where: { id: createdJobId } });
    }
    await prisma.failoverLog.deleteMany({
      where: { reason: { contains: 'Rate limit exceeded (RPM)' } },
    });
  }
}

main()
  .catch((err) => {
    console.error('Failover test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
