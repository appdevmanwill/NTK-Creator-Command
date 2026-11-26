import { prisma } from '@/lib/db';
import { buildZeroKeyMetaPrompt } from './router';
import { AllKeysExhaustedError, TransportHandler } from './types';

export interface CheckpointStep<TState> {
  name: string;
  run: (state: TState, ctx: { jobId: string; transport?: TransportHandler }) => Promise<TState>;
  buildZeroKeyPromptForStep?: (state: TState) => string;
}

export interface CheckpointedRunResult<TState> {
  status: 'COMPLETED' | 'PAUSED_QUOTA' | 'FAILED';
  jobId: string;
  completedSteps: number;
  totalSteps: number;
  state: TState;
  lastProviderUsed?: string | null;
  retryAfterSeconds?: number;
  zeroKeyRemainingPrompt?: string;
  error?: string;
}

export async function runCheckpointedJob<TState extends Record<string, unknown>>(params: {
  existingJobId?: string;
  moduleType: string;
  title: string;
  initialState: TState;
  steps: CheckpointStep<TState>[];
  transport?: TransportHandler;
}): Promise<CheckpointedRunResult<TState>> {
  const totalSteps = params.steps.length;
  let job = params.existingJobId
    ? await prisma.generationJob.findUnique({ where: { id: params.existingJobId } })
    : null;

  let state: TState = params.initialState;
  let startIndex = 0;

  if (job) {
    try {
      state = { ...params.initialState, ...(JSON.parse(job.checkpointStateJson) as TState) };
    } catch {
      state = params.initialState;
    }
    startIndex = Math.min(job.completedSteps, totalSteps);
    job = await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: 'RUNNING', lastError: null },
    });
  } else {
    job = await prisma.generationJob.create({
      data: {
        moduleType: params.moduleType,
        title: params.title,
        status: 'RUNNING',
        totalSteps,
        completedSteps: 0,
        checkpointStateJson: JSON.stringify(state),
      },
    });
  }

  for (let i = startIndex; i < totalSteps; i++) {
    const step = params.steps[i];
    try {
      state = await step.run(state, { jobId: job.id, transport: params.transport });
      const lastProvider: string | null =
        typeof state._lastProviderUsed === 'string' ? state._lastProviderUsed : job.lastProviderUsed;

      job = await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          completedSteps: i + 1,
          checkpointStateJson: JSON.stringify(state),
          lastProviderUsed: lastProvider ?? null,
        },
      });
    } catch (err) {
      if (err instanceof AllKeysExhaustedError) {
        const remainingStepsDesc = params.steps
          .slice(i)
          .map((s, idx) => {
            const custom = s.buildZeroKeyPromptForStep?.(state);
            return `### Remaining Step ${i + idx + 1}/${totalSteps}: ${s.name}\n${custom ?? 'Complete this step based on the prior completed context.'}`;
          })
          .join('\n\n');

        const zeroKeyRemainingPrompt = buildZeroKeyMetaPrompt(
          `${params.title} — Resume From Step ${i + 1} of ${totalSteps}`,
          `Completed Steps: ${i}/${totalSteps}\n\n${remainingStepsDesc}`
        );

        await prisma.generationJob.update({
          where: { id: job.id },
          data: {
            status: 'PAUSED_QUOTA',
            completedSteps: i,
            checkpointStateJson: JSON.stringify(state),
            lastError: err.message.slice(0, 400),
          },
        });

        return {
          status: 'PAUSED_QUOTA',
          jobId: job.id,
          completedSteps: i,
          totalSteps,
          state,
          lastProviderUsed: job.lastProviderUsed,
          retryAfterSeconds: err.retryAfterSeconds,
          zeroKeyRemainingPrompt,
          error: err.message,
        };
      }

      const msg = err instanceof Error ? err.message : String(err);
      await prisma.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          completedSteps: i,
          checkpointStateJson: JSON.stringify(state),
          lastError: msg.slice(0, 400),
        },
      });

      return {
        status: 'FAILED',
        jobId: job.id,
        completedSteps: i,
        totalSteps,
        state,
        error: msg,
      };
    }
  }

  await prisma.generationJob.update({
    where: { id: job.id },
    data: {
      status: 'COMPLETED',
      completedSteps: totalSteps,
      checkpointStateJson: JSON.stringify(state),
      lastError: null,
    },
  });

  return {
    status: 'COMPLETED',
    jobId: job.id,
    completedSteps: totalSteps,
    totalSteps,
    state,
    lastProviderUsed: job.lastProviderUsed,
  };
}
