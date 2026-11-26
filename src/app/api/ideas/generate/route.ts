import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateWithRouter } from '@/lib/ai-router/router';
import { extractJsonFromText } from '@/lib/utils';

const CATEGORIES = [
  'FLOW_MOVIE',
  'FLOW_BULK',
  'NOTEBOOK_GPU',
  'BRAND_MASCOT',
  'AD_SPY',
  'UNIVERSAL_PLAYBOOK',
  'EBOOK',
  'SPREADSHEET',
  'PLANNER',
  'JOURNAL',
  'STORE_FUNNEL',
  'NOTEBOOKLM_CHANNEL',
  'PUBLISH_TOPIC',
] as const;

type IdeaCategory = (typeof CATEGORIES)[number];

const IdeaRequestSchema = z.object({
  category: z.enum(CATEGORIES),
  moodOrNiche: z.string().optional().default('Surprise Me'),
});

interface IdeaEntry {
  label: string;
  tagline: string;
  fields: Record<string, string>;
}

const FIELD_HINTS: Record<IdeaCategory, string> = {
  FLOW_MOVIE: '{ "idea": "1-sentence cinematic movie idea with clear conflict and setting" }',
  FLOW_BULK: '{ "title": "Video title", "topic": "1-line video topic", "recurringCharacter": "Simple visual character description" }',
  NOTEBOOK_GPU: '{ "title": "Project title", "promptOrLyrics": "Clear audio/video/script prompt" }',
  BRAND_MASCOT: '{ "brandOrKeyword": "Channel brand name", "niche": "Clear niche", "mascotIdea": "Simple memorable mascot description" }',
  AD_SPY: '{ "brandOrKeyword": "Digital product keyword to spy on", "niche": "Target niche" }',
  UNIVERSAL_PLAYBOOK: '{ "platformName": "Platform name (e.g. Payhip, Suno, Canva)", "platformUrl": "https://...", "creativeGoal": "Clear beginner goal" }',
  EBOOK: '{ "title": "Promise-driven ebook title", "topic": "Practical problem solved", "audience": "Clear beginner audience" }',
  SPREADSHEET: '{ "title": "Spreadsheet tracker title", "prompt": "What columns/metrics it tracks", "audience": "Target user" }',
  PLANNER: '{ "title": "Planner title", "theme": "Daily focus & habit theme" }',
  JOURNAL: '{ "title": "Workbook/Journal title", "journalType": "Reflection/Budgeting Workbook", "topic": "Core weekly exercises" }',
  STORE_FUNNEL: '{ "productTitle": "Product title", "productSummary": "1-sentence outcome promise", "targetAudience": "Target buyer" }',
  NOTEBOOKLM_CHANNEL: '{ "channelName": "Memorable channel name", "niche": "Evergreen niche", "targetAudience": "Target viewer", "flagshipProduct": "Product + price e.g. Budget OS ($15)" }',
  PUBLISH_TOPIC: '{ "titleOrTopic": "Click-worthy YouTube video title/topic" }',
};

const FALLBACK_BANK: Record<IdeaCategory, IdeaEntry[]> = {
  FLOW_MOVIE: [
    {
      label: 'Midnight Bus Cassette',
      tagline: 'Suspense mystery set on a rainy late-night commute.',
      fields: { idea: 'A tired night-shift nurse finds an unlabeled cassette on a midnight bus that predicts tomorrow morning’s news.' },
    },
    {
      label: 'The Rooftop Solar Kid',
      tagline: 'Uplifting near-future underdog story.',
      fields: { idea: 'A 16-year-old tinkerer builds a pocket solar battery from scrap parts to keep her neighborhood clinic lit during a blackout.' },
    },
    {
      label: 'Key 404 at Old Hotel',
      tagline: 'Cozy mystery with one locked room.',
      fields: { idea: 'A weekend hotel receptionist is handed a brass key for Room 404—even though the fourth floor was bricked up thirty years ago.' },
    },
    {
      label: 'Clockmaker’s Debt',
      tagline: 'Historical drama with high visual contrast.',
      fields: { idea: 'In 1920s Lagos, an apprentice watchmaker discovers an encrypted ledger tucked inside the governor’s broken pocket watch.' },
    },
  ],
  FLOW_BULK: [
    {
      label: 'Silent Wealth Rules',
      tagline: 'High-CPM finance explainer using calm scenes.',
      fields: {
        title: '7 Money Habits That Quietly Double Savings in 12 Months',
        topic: 'Simple weekly cashflow rules for beginners starting from zero',
        recurringCharacter: 'Calm indigo-hoodie stickman carrying a glowing golden coin',
      },
    },
    {
      label: 'Ancient Trade Secrets',
      tagline: 'Evergreen history storytelling.',
      fields: {
        title: 'How One Spice Route Built an Entire Desert Empire',
        topic: 'Visual journey following ancient caravan traders across the Sahara',
        recurringCharacter: 'Storyteller traveler in a deep cobalt cloak with a brass lantern',
      },
    },
    {
      label: 'Focus Reset Protocol',
      tagline: 'Productivity stickman guide.',
      fields: {
        title: 'How to Fix a Scattered Mind in 48 Hours',
        topic: 'Replacing morning phone scrolling with 3 tiny daily anchors',
        recurringCharacter: 'Minimalist slate stickman holding a pocket hourglass',
      },
    },
    {
      label: 'Micro-Product Blueprint',
      tagline: 'Creator business explainer.',
      fields: {
        title: 'Why 1,000 Views Can Earn More Than 100,000 Views',
        topic: 'Pairing small helpful videos with one $15 downloadable template',
        recurringCharacter: 'Friendly geometric owl wearing square glasses',
      },
    },
  ],
  NOTEBOOK_GPU: [
    {
      label: 'Warm Afro-LoFi Focus Beat',
      tagline: 'Royalty-free background track for study & story videos.',
      fields: {
        title: 'Warm Afro-LoFi Study & Storytelling Loop',
        promptOrLyrics: 'Warm electric piano chords, soft shaker percussion, deep mellow bassline, vinyl crackle, 96 BPM instrumental',
      },
    },
    {
      label: 'Suspense Cinema Underscore',
      tagline: 'Moody tension bed for mystery shorts.',
      fields: {
        title: 'Midnight Mystery Tension Underscore',
        promptOrLyrics: 'Sparse pulsing synth bass, soft rain ambience, distant muted piano notes, 110 BPM cinematic instrumental',
      },
    },
    {
      label: 'Product Promo Voiceover Bed',
      tagline: 'Clean upbeat music behind product demos.',
      fields: {
        title: 'Clean Tech Product Launch Beat',
        promptOrLyrics: 'Crisp pluck synths, light clap groove, uplifting warm chord progression, 116 BPM instrumental',
      },
    },
    {
      label: 'Calm Nature Documentary Bed',
      tagline: 'Gentle ambient background for long-form explainers.',
      fields: {
        title: 'Horizon Documentary Ambient Score',
        promptOrLyrics: 'Airy pad textures, acoustic guitar harmonics, gentle marimba pulse, 88 BPM calm instrumental',
      },
    },
  ],
  BRAND_MASCOT: [
    {
      label: 'Quiet Ledger Lab',
      tagline: 'Clean personal finance & spreadsheet channel.',
      fields: {
        brandOrKeyword: 'Quiet Ledger Lab',
        niche: 'Personal Finance & Budget Spreadsheets',
        mascotIdea: 'Friendly navy-blue fox wearing round glasses holding a neat notebook',
      },
    },
    {
      label: 'Lantern Lore',
      tagline: 'Cozy historical & cultural storytelling.',
      fields: {
        brandOrKeyword: 'Lantern Lore',
        niche: 'Forgotten World & African History',
        mascotIdea: 'Warm amber brass lantern character with expressive glowing eyes',
      },
    },
    {
      label: 'Habit Sketch',
      tagline: 'Simple stickman self-improvement explainers.',
      fields: {
        brandOrKeyword: 'Habit Sketch',
        niche: 'Focus, Habits & Student Productivity',
        mascotIdea: 'Crisp charcoal stickman wearing an electric-indigo backpack',
      },
    },
    {
      label: 'Orbit Minute',
      tagline: 'Bite-sized space & science mysteries.',
      fields: {
        brandOrKeyword: 'Orbit Minute',
        niche: 'Space & Everyday Science',
        mascotIdea: 'Tiny silver dome robot with a glowing cyan visor',
      },
    },
  ],
  AD_SPY: [
    {
      label: 'Budget Spreadsheet Templates',
      tagline: 'High-demand evergreen digital template niche.',
      fields: { brandOrKeyword: 'monthly budget spreadsheet', niche: 'Personal Finance Templates' },
    },
    {
      label: 'Digital ADHD / Focus Planner',
      tagline: 'Top-converting printable & tablet planner niche.',
      fields: { brandOrKeyword: 'digital daily planner pdf', niche: 'Productivity Planners' },
    },
    {
      label: 'Small Business Bookkeeping Sheet',
      tagline: 'Strong B2B buyer intent at $15–$29.',
      fields: { brandOrKeyword: 'small business expense tracker', niche: 'Solo Business Tools' },
    },
    {
      label: 'Wedding & Event Checklist Kit',
      tagline: 'Year-round celebration planning niche.',
      fields: { brandOrKeyword: 'wedding planner spreadsheet', niche: 'Event Planning Templates' },
    },
  ],
  UNIVERSAL_PLAYBOOK: [
    {
      label: 'Payhip $0 Store Launch',
      tagline: 'Publish your first PDF or Excel product for $0/month.',
      fields: {
        platformName: 'Payhip',
        platformUrl: 'https://payhip.com',
        creativeGoal: 'Upload my digital product file, write a clear benefit title, set a $15 price, and publish a clean instant-download checkout page.',
      },
    },
    {
      label: 'Selar Africa & Global Checkout',
      tagline: 'Accept NGN, USD, GBP cards with zero monthly fee.',
      fields: {
        platformName: 'Selar',
        platformUrl: 'https://selar.com',
        creativeGoal: 'List a $9–$15 digital ebook + workbook bundle with multi-currency checkout and automatic file delivery.',
      },
    },
    {
      label: 'Suno Royalty-Free Background Music',
      tagline: 'Create custom intro/outro music beds.',
      fields: {
        platformName: 'Suno',
        platformUrl: 'https://suno.com',
        creativeGoal: 'Generate 3 calm instrumental background tracks without vocals for YouTube storytelling videos.',
      },
    },
    {
      label: 'Gumroad Clean Digital Listing',
      tagline: 'Fast storefront for global buyers.',
      fields: {
        platformName: 'Gumroad',
        platformUrl: 'https://gumroad.com',
        creativeGoal: 'Publish a digital template with a crisp cover image, 5 bullet benefits, and instant PDF/XLSX delivery.',
      },
    },
  ],
  EBOOK: [
    {
      label: '30-Day Money Leaks Reset',
      tagline: 'Helps beginners spot and stop wasted weekly spending.',
      fields: {
        title: 'Plug the Leaks: The 30-Day Everyday Money Reset',
        topic: 'How to audit hidden weekly subscriptions, cut food/impulse waste, and build your first $500 safety buffer',
        audience: 'Young earners & students living paycheck to paycheck',
      },
    },
    {
      label: 'First Digital Product Weekend',
      tagline: 'Step-by-step guide to creating and selling a $15 PDF.',
      fields: {
        title: 'Weekend Product Launch: From Zero Ideas to First Digital Sale',
        topic: 'Picking one everyday problem, writing a short helpful guide, and listing it on a $0/month store',
        audience: 'Complete beginners starting an online side income',
      },
    },
    {
      label: 'Phone-Free Focus Playbook',
      tagline: 'Practical routine to reclaim 2 focused hours daily.',
      fields: {
        title: 'The 2-Hour Focus Protocol for Distracted Minds',
        topic: 'Simple morning habits, notification rules, and 25-minute work sprints that double daily output',
        audience: 'Students and remote workers struggling with procrastination',
      },
    },
    {
      label: 'Meal & Grocery Budget Blueprint',
      tagline: 'Saves families 25%+ on monthly food costs.',
      fields: {
        title: 'Smart Kitchen, Half the Bill: Weekly Meal & Grocery Planning',
        topic: 'Batch-prep shopping lists, pantry rotation, and zero-waste weekly menus on a tight budget',
        audience: 'Busy households and college students',
      },
    },
  ],
  SPREADSHEET: [
    {
      label: 'Paycheck & Bill Split Tracker',
      tagline: 'Auto-calculates bills, savings, and safe daily spending.',
      fields: {
        title: 'Paycheck-to-Paycheck Bill & Savings Splitter',
        prompt: 'Track every paycheck, fixed bills, debt payments, savings transfers, and safe weekly spending balance',
        audience: 'Salaried workers & students managing monthly cashflow',
      },
    },
    {
      label: 'Side-Hustle Profit & Expense Sheet',
      tagline: 'Shows real net profit for solo sellers.',
      fields: {
        title: 'Creator & Side-Hustle Profit Dashboard',
        prompt: 'Log product sales, platform fees, software expenses, ad spend, and net monthly profit by category',
        audience: 'Freelancers, digital creators, and small shop owners',
      },
    },
    {
      label: '90-Day Debt Snowball Planner',
      tagline: 'Visualizes debt payoff progress automatically.',
      fields: {
        title: '90-Day Debt Payoff & Freedom Tracker',
        prompt: 'Track loan balances, monthly interest, extra payments, and payoff milestones across categories',
        audience: 'Anyone paying down credit cards or personal loans',
      },
    },
    {
      label: 'Event & Wedding Budget Control',
      tagline: 'Prevents surprise overspending before event day.',
      fields: {
        title: 'Stress-Free Event & Celebration Budget Sheet',
        prompt: 'Compare estimated vs actual vendor deposits, catering, venue, outfits, and guest count totals',
        audience: 'Couples and small event organizers',
      },
    },
  ],
  PLANNER: [
    {
      label: '30-Day Side-Hustle Action Planner',
      tagline: '1 small task a day to launch without overwhelm.',
      fields: {
        title: 'The 30-Day Side-Hustle Momentum Planner',
        theme: 'Daily 30-minute focus block, one tiny daily win, and weekly review',
      },
    },
    {
      label: 'Student Exam & Study Sprint',
      tagline: 'Organizes study blocks, weak topics, and sleep habits.',
      fields: {
        title: 'Calm Exam & Deep-Study 30-Day Planner',
        theme: 'Time-blocked revision, active recall checklist, and stress-free evening wind-down',
      },
    },
    {
      label: 'No-Spend Challenge Tracker',
      tagline: 'Turns saving money into a 30-day visual game.',
      fields: {
        title: '30-Day Zero-Impulse Spending Planner',
        theme: 'Daily no-spend streaks, urge triggers, and money saved tally',
      },
    },
    {
      label: 'Creator Consistency 365 Planner',
      tagline: 'Tracks hooks, scripts, uploads, and store clicks.',
      fields: {
        title: 'Faceless Creator Consistency Planner',
        theme: 'Hook bank, filming/generation checklist, upload cadence, and monthly review',
      },
    },
  ],
  JOURNAL: [
    {
      label: 'Money Mindset & Trigger Workbook',
      tagline: 'Uncovers emotional spending habits gently.',
      fields: {
        title: 'Calm Money Habits & Spending Reflection Workbook',
        journalType: 'Budgeting & Mindset Workbook',
        topic: 'Weekly spending check-ins, impulse-buy pause prompts, and savings celebrations',
      },
    },
    {
      label: 'Sunday Reset Clarity Journal',
      tagline: '15-minute weekly reflection for calmer Mondays.',
      fields: {
        title: 'The Sunday Reset Weekly Reflection Journal',
        journalType: 'Guided Reflection Journal',
        topic: 'Reviewing weekly wins, clearing mental clutter, and picking 3 calm priorities for Monday',
      },
    },
    {
      label: 'Beginner Confidence & Action Log',
      tagline: 'Helps shy starters track small daily courage steps.',
      fields: {
        title: 'Small Brave Steps: 30-Day Action Workbook',
        journalType: 'Personal Growth Workbook',
        topic: 'Overcoming perfectionism, shipping imperfect drafts, and celebrating consistency',
      },
    },
    {
      label: 'Gratitude & Financial Peace Log',
      tagline: 'Pairs daily gratitude with simple saving goals.',
      fields: {
        title: 'Daily Gratitude & Peaceful Finances Journal',
        journalType: 'Mindful Money Journal',
        topic: 'Three daily gratitudes, one smart money choice, and evening peace check-in',
      },
    },
  ],
  STORE_FUNNEL: [
    {
      label: 'Paycheck Splitter Bundle ($15)',
      tagline: 'High-converting starter finance offer.',
      fields: {
        productTitle: 'The 30-Day Paycheck & Budget Reset Kit',
        productSummary: 'An easy Excel tracker + short PDF guide that shows where every dollar goes in under 15 minutes a week.',
        targetAudience: 'Beginners tired of wondering where their paycheck disappeared',
      },
    },
    {
      label: 'Student Focus Planner ($9)',
      tagline: 'Impulse-buy friendly price point.',
      fields: {
        productTitle: 'Calm Study & Exam Sprint Digital Planner',
        productSummary: 'A clean printable & tablet-ready 30-day planner that replaces overwhelm with clear 25-minute study blocks.',
        targetAudience: 'College students and self-learners preparing for exams',
      },
    },
    {
      label: 'Creator Prompt & Script Kit ($19)',
      tagline: 'Appeals to aspiring faceless channels.',
      fields: {
        productTitle: 'Faceless Story & Hook Starter Kit',
        productSummary: '50 proven 10-second opening hooks plus a step-by-step video checklist to launch without showing your face.',
        targetAudience: 'Shy beginners wanting to start a faceless YouTube channel',
      },
    },
    {
      label: 'Zero-Waste Meal Planner ($12)',
      tagline: 'Practical everyday household saver.',
      fields: {
        productTitle: 'Half-Bill Weekly Meal & Grocery Planner',
        productSummary: 'Reusable weekly meal templates and smart grocery lists designed to cut food waste by 25%.',
        targetAudience: 'Busy families and young adults cooking on a budget',
      },
    },
  ],
  NOTEBOOKLM_CHANNEL: [
    {
      label: 'Quiet Ledger Academy',
      tagline: 'Evergreen budgeting + Excel kit channel.',
      fields: {
        channelName: 'Quiet Ledger Academy',
        niche: 'Personal Finance & Budgeting',
        targetAudience: 'Young earners building their first emergency fund',
        flagshipProduct: 'Paycheck & Budget OS ($15)',
      },
    },
    {
      label: 'Focus Sketch Club',
      tagline: 'Stickman productivity + planner funnel.',
      fields: {
        channelName: 'Focus Sketch Club',
        niche: 'Study Habits & Beat Procrastination',
        targetAudience: 'Students and remote workers',
        flagshipProduct: '30-Day Deep Focus Planner ($12)',
      },
    },
    {
      label: 'Lantern History Tales',
      tagline: 'Story-driven historical essays + illustrated ebook.',
      fields: {
        channelName: 'Lantern History Tales',
        niche: 'World & African History Stories',
        targetAudience: 'Curious evening documentary listeners',
        flagshipProduct: 'Illustrated Forgotten Empires Ebook ($14)',
      },
    },
    {
      label: 'Simple Side Income',
      tagline: 'Beginner-friendly digital product tutorials.',
      fields: {
        channelName: 'Simple Side Income',
        niche: 'Digital Products & Creator Tools',
        targetAudience: 'First-time online creators starting with $0',
        flagshipProduct: 'Weekend Product Launch Workbook ($15)',
      },
    },
  ],
  PUBLISH_TOPIC: [
    {
      label: '3 Money Leaks Fixed in 10 Mins',
      tagline: 'High-curiosity practical finance hook.',
      fields: { titleOrTopic: '3 Quiet Money Leaks Keeping You Broke (And the 10-Minute Fix)' },
    },
    {
      label: 'How I Built a $15 Sheet From Scratch',
      tagline: 'Behind-the-scenes tutorial driving store clicks.',
      fields: { titleOrTopic: 'How to Build & Sell a Simple Budget Spreadsheet With Zero Experience' },
    },
    {
      label: 'The 5AM Phone-Free Morning Test',
      tagline: 'Relatable transformation story.',
      fields: { titleOrTopic: 'I Quit Checking My Phone for 7 Mornings — Here Is What Changed' },
    },
    {
      label: 'One Product, Ten Simple Videos',
      tagline: 'Creator growth breakdown.',
      fields: { titleOrTopic: 'Why You Only Need 1 Good Digital Product to Start Earning Online' },
    },
  ],
};

export async function POST(req: NextRequest) {
  try {
    const body = IdeaRequestSchema.parse(await req.json());
    const mood = body.moodOrNiche?.trim() || 'Surprise Me';
    const seedHint = Math.floor(Math.random() * 9000 + 1000);

    const prompt = `Generate 4 fresh, beginner-friendly creative ideas for a novice student who has a completely blank mind and doesn't know what to type yet.
Studio Category: ${body.category}
Student Vibe / Interest: ${mood}
Freshness Seed: ${seedHint}

Requirements:
- Keep every idea crystal clear, practical, zero-jargon, and immediately usable by a beginner.
- Return STRICT JSON ONLY matching this exact schema:
{
  "ideas": [
    {
      "label": "Short 2-5 word title",
      "tagline": "1 plain-English sentence explaining why this works",
      "fields": ${FIELD_HINTS[body.category]}
    }
  ]
}`;

    try {
      const res = await generateWithRouter({
        taskType: 'fast_generation',
        prompt,
        systemPrompt: 'You help shy, blank-slate beginners start creating in seconds. Return strict valid JSON only.',
        jsonMode: true,
        temperature: 0.85,
        maxOutputTokens: 1600,
      });
      const parsed = extractJsonFromText<{ ideas?: IdeaEntry[] }>(res.text);
      if (Array.isArray(parsed.ideas) && parsed.ideas.length > 0) {
        const sanitized = parsed.ideas.slice(0, 4).map((item, idx) => ({
          label: String(item.label || `Idea ${idx + 1}`),
          tagline: String(item.tagline || 'Beginner-friendly starter idea'),
          fields: Object.fromEntries(
            Object.entries(item.fields ?? {}).map(([k, v]) => [k, String(v ?? '')])
          ),
        }));
        return NextResponse.json({
          ideas: sanitized,
          provider: `${res.provider}/${res.model}`,
        });
      }
    } catch {
      // Seamless fallback bank so blank students never hit a dead end
    }

    const bank = [...(FALLBACK_BANK[body.category] ?? [])];
    for (let i = bank.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bank[i], bank[j]] = [bank[j], bank[i]];
    }
    return NextResponse.json({
      ideas: bank.slice(0, 4),
      provider: 'Instant Starter Bank',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not generate ideas' },
      { status: 400 }
    );
  }
}
