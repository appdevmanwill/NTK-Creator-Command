import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateWithRouter } from '@/lib/ai-router/router';
import { compileAndSaveZipPack } from '@/lib/packs/zip-compiler';
import { extractJsonFromText } from '@/lib/utils';

const PublishSchema = z.object({
  mode: z.enum(['BROWSER_DRAFT', 'YOUTUBE_OAUTH']),
  platforms: z.array(z.string()).default(['YouTube']),
  localVideoPath: z.string().default('C:\\Videos\\final_release.mp4'),
  localThumbnailPath: z.string().default('C:\\Videos\\thumbnail.png'),
  titleOrTopic: z.string().min(1),
  storeLink: z.string().default('https://payhip.com/ntkhub/product'),
  scheduleIso: z.string().default('2026-12-01T15:00:00Z'),
});

export async function POST(req: NextRequest) {
  try {
    const body = PublishSchema.parse(await req.json());

    let seo = {
      seoTitle: `${body.titleOrTopic} (Complete Step-by-Step Guide)`,
      description: `Get the complete toolkit & instant download here: ${body.storeLink}\n\nIn this video, we break down ${body.titleOrTopic} step by step so you can apply it today.\n\nChapters:\n00:00 Hook & Key Promise\n01:20 Core Framework\n04:30 Practical Walkthrough\n07:45 Next Steps`,
      pinnedComment: `Grab the exact templates & guide mentioned in this video here -> ${body.storeLink}`,
      tags: ['creator economy', 'digital products', 'tutorial', 'step by step', 'passive tools'],
      hashtags: ['#DigitalProducts', '#CreatorEconomy', '#Productivity'],
    };
    let providerSummary = 'Deterministic SEO Preset';

    try {
      const res = await generateWithRouter({
        taskType: 'fast_generation',
        prompt: `Optimize YouTube/Social publishing metadata for "${body.titleOrTopic}".
Must place the Digital Product Store Link (${body.storeLink}) near the very top of the description.
Return STRICT JSON:
{
  "seoTitle": "High-CTR SEO title under 75 chars",
  "description": "Full description with ${body.storeLink} in the first 2 lines",
  "pinnedComment": "Engaging pinned comment CTA linking to ${body.storeLink}",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6"],
  "hashtags": ["#Tag1", "#Tag2", "#Tag3"]
}`,
        jsonMode: true,
        maxOutputTokens: 1536,
      });
      seo = extractJsonFromText<typeof seo>(res.text);
      providerSummary = `${res.provider}/${res.model}`;
    } catch {
      // keep preset
    }

    const metadataJson = JSON.stringify(
      {
        mode: body.mode,
        platforms: body.platforms,
        localVideoPath: body.localVideoPath,
        localThumbnailPath: body.localThumbnailPath,
        schedulePublishAt: body.scheduleIso,
        storeLink: body.storeLink,
        ...seo,
      },
      null,
      2
    );

    const copyPasteSheet = `# Copy-Paste Publishing Sheet

- **Title:** ${seo.seoTitle}
- **Target Platforms:** ${body.platforms.join(', ')}
- **Scheduled Publish:** ${body.scheduleIso}
- **Local Video:** \`${body.localVideoPath}\`
- **Local Thumbnail:** \`${body.localThumbnailPath}\`

## Description
\`\`\`
${seo.description}
\`\`\`

## Pinned Comment CTA
\`\`\`
${seo.pinnedComment}
\`\`\`

## Tags
${seo.tags.join(', ')}

## Hashtags
${seo.hashtags.join(' ')}
`;

    if (body.mode === 'BROWSER_DRAFT') {
      const agentInstructions = `# Safe Browser Draft & Upload Instructions (Mode A)

- **Browser:** BrowserOS neo using profile **\`FEAICCWS\`**
- **Safety Rule:** Keep **Turbo Mode OFF** to avoid anti-bot triggers.
- **Target Platforms:** ${body.platforms.join(', ')}

## Step-by-Step Workflow
1. Open BrowserOS neo (\`FEAICCWS\`) and navigate to YouTube Studio (and/or ${body.platforms.join(', ')}).
2. Click **Create -> Upload videos** and select \`${body.localVideoPath}\`.
3. Paste Title, Description (store link at top), and Tags from \`copy_paste_sheet.md\`.
4. Upload custom thumbnail \`${body.localThumbnailPath}\`.
5. Set Visibility to **Scheduled** (${body.scheduleIso}) OR **Save as Draft**.
6. **MANDATORY HUMAN STOP:** STOP on the Final Review / Draft confirmation screen and notify the human owner to click Publish/Schedule manually. Do NOT click final Publish automatically.
`;

      const files = [
        { path: 'metadata.json', content: metadataJson },
        { path: 'copy_paste_sheet.md', content: copyPasteSheet },
        { path: 'publish_agent_instructions.md', content: agentInstructions },
      ];

      const compiled = await compileAndSaveZipPack({
        type: 'PUBLISH_PACK',
        title: `Publish Draft Pack — ${seo.seoTitle}`,
        metadata: { mode: body.mode, platforms: body.platforms },
        textFiles: files,
      });

      return NextResponse.json({
        projectId: compiled.project.id,
        files,
        providerSummary,
      });
    }

    // Mode B — Official YouTube API / OAuth Setup Pack
    const oauthSetupMd = `# Official YouTube Data API v3 OAuth Setup Pack (Mode B)

1. Open BrowserOS neo (\`FEAICCWS\`) -> https://console.cloud.google.com/
2. Create or select a free Google Cloud project (Cost: $0).
3. Enable **YouTube Data API v3**.
4. Configure OAuth Consent Screen (External -> add your YouTube Google account as Test User).
5. Create **OAuth Client ID -> Desktop App** and download \`client_secrets.json\` into this folder.
6. Install Python requirements:
   \`\`\`bash
   pip install -r requirements.txt
   \`\`\`
7. Run the resumable uploader:
   \`\`\`bash
   python youtube_uploader.py --metadata metadata.json
   \`\`\`
`;

    const pythonUploader = `#!/usr/bin/env python3
"""NTK Creator Command — Official YouTube Data API v3 Resumable Uploader."""
import argparse
import json
import os
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]


def get_authenticated_service(secrets_path: str = "client_secrets.json", token_path: str = "token.json"):
    creds = None
    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(secrets_path, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(token_path, "w", encoding="utf-8") as f:
            f.write(creds.to_json())
    return build("youtube", "v3", credentials=creds)


def upload_video(metadata_path: str) -> None:
    with open(metadata_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    youtube = get_authenticated_service()
    body = {
        "snippet": {
            "title": meta["seoTitle"],
            "description": meta["description"],
            "tags": meta.get("tags", []),
            "categoryId": "22",
        },
        "status": {
            "privacyStatus": "private",
            "publishAt": meta.get("schedulePublishAt"),
            "selfDeclaredMadeForKids": False,
        },
    }

    media = MediaFileUpload(meta["localVideoPath"], chunksize=1024 * 1024 * 4, resumable=True)
    request = youtube.videos().insert(part="snippet,status", body=body, media_body=media)

    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            print(f"Upload progress: {int(status.progress() * 100)}%")

    video_id = response["id"]
    print(f"Uploaded video ID: {video_id}")

    thumb_path = meta.get("localThumbnailPath")
    if thumb_path and os.path.exists(thumb_path):
        youtube.thumbnails().set(
            videoId=video_id,
            media_body=MediaFileUpload(thumb_path),
        ).execute()
        print("Thumbnail uploaded successfully.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Upload video + thumbnail via YouTube OAuth")
    parser.add_argument("--metadata", default="metadata.json")
    args = parser.parse_args()
    upload_video(args.metadata)
`;

    const files = [
      { path: 'oauth_setup_instructions.md', content: oauthSetupMd },
      { path: 'youtube_uploader.py', content: pythonUploader },
      {
        path: 'requirements.txt',
        content: 'google-api-python-client>=2.150.0\ngoogle-auth-httplib2>=0.2.0\ngoogle-auth-oauthlib>=1.2.0\n',
      },
      { path: 'metadata.json', content: metadataJson },
      { path: 'copy_paste_sheet.md', content: copyPasteSheet },
    ];

    const compiled = await compileAndSaveZipPack({
      type: 'OAUTH_PACK',
      title: `YouTube OAuth Uploader — ${seo.seoTitle}`,
      metadata: { mode: body.mode, scheduleIso: body.scheduleIso },
      textFiles: files,
    });

    return NextResponse.json({
      projectId: compiled.project.id,
      files,
      providerSummary,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to build publish pack' },
      { status: 400 }
    );
  }
}
