import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateWithRouter, buildZeroKeyMetaPrompt } from '@/lib/ai-router/router';
import { AllKeysExhaustedError } from '@/lib/ai-router/types';
import { compileAndSaveZipPack } from '@/lib/packs/zip-compiler';
import { extractJsonFromText } from '@/lib/utils';

const UniversalSchema = z.object({
  platformName: z.string().min(1),
  platformUrl: z.string().min(1),
  creativeGoal: z.string().min(1),
  targetAgent: z.enum(['ANTIGRAVITY', 'CODEX']).default('ANTIGRAVITY'),
});

export async function POST(req: NextRequest) {
  try {
    const body = UniversalSchema.parse(await req.json());
    const agentName = body.targetAgent === 'CODEX' ? 'OpenAI Codex' : 'Google Antigravity';

    const prompt = `Create an executable ${agentName} automation playbook for platform "${body.platformName}" (${body.platformUrl}).
Creative Goal: ${body.creativeGoal}
Environment Requirement: Must use BrowserOS neo profile "FEAICCWS", keep Turbo Mode OFF, verify outputs before download, and respect rate limits.

Return STRICT JSON:
{
  "readme": "Overview & prerequisites markdown",
  "agentInstructions": "Step-by-step UI/browser workflow for ${agentName} on BrowserOS neo FEAICCWS",
  "prompts": "Ready-to-paste creative prompts / inputs for ${body.platformName}",
  "qaChecklist": "Verification checklist before finishing",
  "postProcess": "CPU-friendly post-processing / packaging instructions"
}`;

    try {
      const res = await generateWithRouter({
        taskType: 'long_context',
        prompt,
        jsonMode: true,
        maxOutputTokens: 4096,
      });

      const parsed = extractJsonFromText<{
        readme: string;
        agentInstructions: string;
        prompts: string;
        qaChecklist: string;
        postProcess: string;
      }>(res.text);

      const files = [
        { path: 'README.md', content: parsed.readme },
        { path: 'agent_instructions.md', content: parsed.agentInstructions },
        { path: 'prompts.md', content: parsed.prompts },
        { path: 'qa_checklist.md', content: parsed.qaChecklist },
        { path: 'post_process.md', content: parsed.postProcess },
      ];

      const compiled = await compileAndSaveZipPack({
        type: 'UNIVERSAL_PACK',
        title: `${body.platformName} Playbook`,
        metadata: { platformUrl: body.platformUrl, targetAgent: body.targetAgent },
        textFiles: files,
      });

      return NextResponse.json({
        projectId: compiled.project.id,
        files,
        providerSummary: `${res.provider}/${res.model}`,
        triggerPrompts: [
          {
            label: `Execute with ${agentName}`,
            prompt: `Use BrowserOS neo profile FEAICCWS. Read README.md and agent_instructions.md for ${body.platformName} (${body.platformUrl}), apply prompts.md with Turbo Mode OFF, verify via qa_checklist.md, and run post_process.md.`,
          },
        ],
      });
    } catch (err) {
      if (err instanceof AllKeysExhaustedError) {
        return NextResponse.json(
          { zeroKeyMode: true, zeroKeyPrompt: buildZeroKeyMetaPrompt('Universal Platform Playbook', prompt), error: err.message },
          { status: 429 }
        );
      }
      throw err;
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to build universal pack' },
      { status: 400 }
    );
  }
}
