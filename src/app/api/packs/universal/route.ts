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

    let parsed: {
      readme: string;
      agentInstructions: string;
      prompts: string;
      qaChecklist: string;
      postProcess: string;
    };
    let providerSummary = 'Offline Studio Engine';

    try {
      const res = await generateWithRouter({
        taskType: 'long_context',
        prompt,
        jsonMode: true,
        maxOutputTokens: 4096,
      });

      parsed = extractJsonFromText(res.text);
      providerSummary = `${res.provider}/${res.model}`;
    } catch (err) {
      if (!(err instanceof AllKeysExhaustedError)) throw err;
      parsed = {
        readme: `# ${body.platformName} Playbook (${agentName})\n\n- **Target URL:** ${body.platformUrl}\n- **Goal:** ${body.creativeGoal}\n- **Profile:** BrowserOS neo (\`FEAICCWS\`)`,
        agentInstructions: `1. Open ${body.platformUrl} in BrowserOS neo profile \`FEAICCWS\`.\n2. Keep Turbo Mode OFF and confirm settings.\n3. Paste prompts from \`prompts.md\` one section at a time and inspect outputs before downloading.`,
        prompts: `### Primary Prompt for ${body.platformName}\nCreate "${body.creativeGoal}" with clean editorial consistency and clear subject framing.`,
        qaChecklist: `- [ ] Output matches "${body.creativeGoal}"\n- [ ] No visual artifacts or truncated text\n- [ ] Files saved in project folder`,
        postProcess: `Assemble finished assets locally using FFmpeg stream copy (\`-c copy\`) or package final deliverables in NTK Creator Command Vault.`,
      };
    }

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
      providerSummary,
      triggerPrompts: [
        {
          label: `Execute with ${agentName}`,
          prompt: `Use BrowserOS neo profile FEAICCWS. Read README.md and agent_instructions.md for ${body.platformName} (${body.platformUrl}), apply prompts.md with Turbo Mode OFF, verify via qa_checklist.md, and run post_process.md.`,
        },
      ],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to build universal pack' },
      { status: 400 }
    );
  }
}
