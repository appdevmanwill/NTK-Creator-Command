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
  FLOW_MOVIE: '{ "idea": "1-sentence cinematic premise with clear stakes, setting, and tactile object" }',
  FLOW_BULK: '{ "title": "Editorial video title", "topic": "1-line thesis", "recurringCharacter": "Distinctive visual silhouette character description" }',
  NOTEBOOK_GPU: '{ "title": "Project title", "promptOrLyrics": "Specific instrumentation, mood, tempo, and mastering cue" }',
  BRAND_MASCOT: '{ "brandOrKeyword": "Distinctive studio or channel house name", "niche": "Clear niche", "mascotIdea": "Architectural emblem or memorable mascot description" }',
  AD_SPY: '{ "brandOrKeyword": "High-margin digital product keyword to audit", "niche": "Target category" }',
  UNIVERSAL_PLAYBOOK: '{ "platformName": "Platform name (e.g. Payhip, Selar, Suno, Gumroad)", "platformUrl": "https://...", "creativeGoal": "Clear launch goal" }',
  EBOOK: '{ "title": "Publication-grade editorial title", "topic": "Concrete reader outcome", "audience": "Specific reader profile" }',
  SPREADSHEET: '{ "title": "Executive spreadsheet model title", "prompt": "Specific cashflows, categories, and decision metrics tracked", "audience": "Target user" }',
  PLANNER: '{ "title": "Editorial planner title", "theme": "Focused cadence and discipline framework" }',
  JOURNAL: '{ "title": "Guided edition title", "journalType": "Reflection/Decision Workbook", "topic": "Structured weekly exercises" }',
  STORE_FUNNEL: '{ "productTitle": "Product edition title", "productSummary": "1-sentence concrete value statement", "targetAudience": "Specific buyer profile" }',
  NOTEBOOKLM_CHANNEL: '{ "channelName": "Memorable publication or house name", "niche": "Evergreen category", "targetAudience": "Target viewer", "flagshipProduct": "Flagship edition + price e.g. Sovereign Ledger ($15)" }',
  PUBLISH_TOPIC: '{ "titleOrTopic": "High-authority YouTube title/premise" }',
};

const FALLBACK_BANK: Record<IdeaCategory, IdeaEntry[]> = {
  FLOW_MOVIE: [
    {
      label: 'Nocturne on Carter Bridge',
      tagline: 'Atmospheric suspense set during a midnight power outage.',
      fields: {
        idea: 'On a fog-bound Lagos bridge at 2:00 AM, a lone courier opens a brass courier tube holding blueprints that predict the city’s next grid failure.',
      },
    },
    {
      label: 'Room 404 at Hotel Meridian',
      tagline: 'Chamber mystery built around one sealed floor.',
      fields: {
        idea: 'A weekend night clerk at a grand coastal hotel is handed a key to Room 404, even though the fourth floor was bricked behind mahogany paneling thirty years ago.',
      },
    },
    {
      label: 'The Clockmaker of Marina',
      tagline: '1920s period intrigue with tactile gold-and-ebony detail.',
      fields: {
        idea: 'In 1924 Lagos, an apprentice horologist discovers an encrypted harbor cipher engraved inside the governor’s broken pocket watch.',
      },
    },
    {
      label: 'Star Charts of Timbuktu',
      tagline: 'Historical drama driven by quiet courage and spectacle.',
      fields: {
        idea: 'Before a Saharan dust wall reaches the city gates, a young astronomer races across lantern-lit rooftops to move seven irreplaceable celestial folios underground.',
      },
    },
  ],
  FLOW_BULK: [
    {
      label: 'The Architecture of Quiet Wealth',
      tagline: 'High-CPM finance essay pairing calm pacing with a flagship sheet.',
      fields: {
        title: 'Seven Quiet Balance-Sheet Rules That Outperform Loud Income',
        topic: 'Structuring weekly savings transfers and low-overhead cash reserves from a modest salary',
        recurringCharacter: 'Charcoal silhouette analyst in a tailored camel overcoat carrying a brass ledger',
      },
    },
    {
      label: 'The Forgotten Gold Coast Trade',
      tagline: 'Documentary narrative built for evening long-form viewers.',
      fields: {
        title: 'How One Trans-Saharan Route Reshaped Mediterranean Finance',
        topic: 'Tracing gold weigh-stations, brass weights, and library cities across medieval West Africa',
        recurringCharacter: 'Hooded chronicler in deep obsidian cloak holding a warm amber astrolabe',
      },
    },
    {
      label: 'Cognitive Monasticism',
      tagline: 'Refined deep-work essay with clear visual metaphors.',
      fields: {
        title: 'Forty-Eight Hours Without Reactive Feeds: A Focus Protocol',
        topic: 'Rebuilding morning attention spans through three scheduled paper rituals',
        recurringCharacter: 'Minimalist slate figure beside an alabaster desk lamp and mechanical sandglass',
      },
    },
    {
      label: 'Small Catalog, High Margin',
      tagline: 'Digital publishing case study with strong product intent.',
      fields: {
        title: 'Why Four Thousand Focused Viewers Outearn Viral Noise',
        topic: 'Pairing high-trust tutorials with a single $15 print-grade edition',
        recurringCharacter: 'Crisp geometric ink owl wearing thin brass spectacles',
      },
    },
  ],
  NOTEBOOK_GPU: [
    {
      label: 'Obsidian Afro-LoFi Chamber',
      tagline: 'Warm dusk instrumentation suited to essays and reading rooms.',
      fields: {
        title: 'Obsidian Afro-LoFi Evening Score',
        promptOrLyrics: 'Muted Rhodes electric piano, brushed shaker groove, warm upright bassline, subtle analog tape warmth, 94 BPM instrumental',
      },
    },
    {
      label: 'Carter Bridge Noir Tension',
      tagline: 'Restrained cinematic bed for thriller shorts and cold opens.',
      fields: {
        title: 'Carter Bridge Noir Underscore',
        promptOrLyrics: 'Low cello pulse, distant rain texture, sparse felt piano harmonics, deep sub swell, 106 BPM instrumental',
      },
    },
    {
      label: 'Atelier Edition Launch Cue',
      tagline: 'Polished minimalist soundtrack for digital product walkthroughs.',
      fields: {
        title: 'Atelier Editorial Launch Pulse',
        promptOrLyrics: 'Crisp acoustic pluck arpeggios, refined rim-click groove, uplifting Rhodes chords, 114 BPM clean master',
      },
    },
    {
      label: 'Horizon Documentary Bed',
      tagline: 'Spacious ambient texture for long-form historical narration.',
      fields: {
        title: 'Horizon Documentary Chamber Bed',
        promptOrLyrics: 'Warm string pads, gentle wooden marimba ostinato, clean nylon acoustic harmonic swells, 86 BPM calm instrumental',
      },
    },
  ],
  BRAND_MASCOT: [
    {
      label: 'Meridian Ledger House',
      tagline: 'Private editorial identity for personal finance & spreadsheets.',
      fields: {
        brandOrKeyword: 'Meridian Ledger House',
        niche: 'Personal Finance & Allocation Models',
        mascotIdea: 'Geometric brass compass owl emblem with crisp ivory linework on matte obsidian',
      },
    },
    {
      label: 'Atelier Chronos',
      tagline: 'Elevated historical storytelling and documentary monographs.',
      fields: {
        brandOrKeyword: 'Atelier Chronos',
        niche: 'World & West African History Essays',
        mascotIdea: 'Architectural brushed-gold astrolabe crest framed in warm parchment tones',
      },
    },
    {
      label: 'Quiet Focus Press',
      tagline: 'Study architecture, paper rituals, and calm productivity.',
      fields: {
        brandOrKeyword: 'Quiet Focus Press',
        niche: 'Deep Work & Student Editions',
        mascotIdea: 'Minimalist obsidian fountain nib transforming into an illuminated window frame',
      },
    },
    {
      label: 'Observatory Dispatch',
      tagline: 'Accessible astronomy, physics, and scientific curiosities.',
      fields: {
        brandOrKeyword: 'Observatory Dispatch',
        niche: 'Science & Space Chronicles',
        mascotIdea: 'Brass tabletop telescope silhouette inside a double champagne hairline ring',
      },
    },
  ],
  AD_SPY: [
    {
      label: 'Household Allocation Models',
      tagline: 'High-intent evergreen spreadsheet demand year-round.',
      fields: { brandOrKeyword: 'household cashflow allocation spreadsheet', niche: 'Personal Finance Editions' },
    },
    {
      label: 'Hyperlinked Executive Planners',
      tagline: 'Consistent tablet & printable productivity conversions.',
      fields: { brandOrKeyword: 'hyperlinked daily focus planner pdf', niche: 'Executive & Student Planners' },
    },
    {
      label: 'Solo Studio Bookkeeping Kits',
      tagline: 'Strong $15-$29 buyer willingness among freelancers.',
      fields: { brandOrKeyword: 'solo creator bookkeeping ledger xlsx', niche: 'Independent Business Tools' },
    },
    {
      label: 'Milestone Event Budget Books',
      tagline: 'High-ticket event organization templates with clear ROI.',
      fields: { brandOrKeyword: 'wedding vendor budget workbook', niche: 'Event Planning Editions' },
    },
  ],
  UNIVERSAL_PLAYBOOK: [
    {
      label: 'Payhip Signature Listing',
      tagline: 'Launch an instant-download edition at $0/month fixed cost.',
      fields: {
        platformName: 'Payhip',
        platformUrl: 'https://payhip.com',
        creativeGoal: 'Publish a flagship PDF edition and Excel companion bundle at $15 with tailored benefit bullets and instant checkout delivery.',
      },
    },
    {
      label: 'Selar Multi-Currency Desk',
      tagline: 'Accept NGN, USD, and GBP buyers cleanly.',
      fields: {
        platformName: 'Selar',
        platformUrl: 'https://selar.com',
        creativeGoal: 'List an illustrated digital handbook + workbook pairing with local and international card settlement.',
      },
    },
    {
      label: 'Suno Chamber Score Workflow',
      tagline: 'Produce bespoke vocal-free narration underscores.',
      fields: {
        platformName: 'Suno',
        platformUrl: 'https://suno.com',
        creativeGoal: 'Compose three restrained 94 BPM instrumental beds engineered to sit cleanly beneath documentary narration.',
      },
    },
    {
      label: 'Gumroad Editorial Storefront',
      tagline: 'Convert organic channel traffic into instant sales.',
      fields: {
        platformName: 'Gumroad',
        platformUrl: 'https://gumroad.com',
        creativeGoal: 'Stage a minimalist edition storefront featuring preview spreads, a $15 anchor price, and automatic digital fulfillment.',
      },
    },
  ],
  EBOOK: [
    {
      label: "The Quiet Compounder's Ledger",
      tagline: 'Shows readers how to reclaim silent weekly leaks into steady reserves.',
      fields: {
        title: "The Quiet Compounder's Ledger",
        topic: 'Identifying invisible recurring charges, restructuring paycheck splits, and building a resilient $1,000 starter reserve',
        audience: 'Young professionals and independent earners building financial calm',
      },
    },
    {
      label: 'First Edition in Forty-Eight Hours',
      tagline: 'Guides beginners from a single practical skill to a live $15 listing.',
      fields: {
        title: 'First Edition in Forty-Eight Hours',
        topic: 'Selecting one concrete buyer problem, drafting a tight 25-page handbook, and publishing on a zero-fee storefront',
        audience: 'First-time digital authors launching without an existing audience',
      },
    },
    {
      label: 'Stillness Architecture',
      tagline: 'Rebuilds daily cognitive stamina for students and solo builders.',
      fields: {
        title: 'Stillness Architecture: Reclaiming Deep Attention',
        topic: 'Eliminating fragmented mornings with ninety-minute protected focus blocks and structured paper checklists',
        audience: 'University students and remote builders overwhelmed by constant alerts',
      },
    },
    {
      label: 'Pantry Economics',
      tagline: 'Cuts monthly household grocery spend without sacrificing nutrition.',
      fields: {
        title: 'Pantry Economics: The Structured Weekly Table',
        topic: 'Building rotating staple inventories, waste-proof prep schedules, and predictable weekly grocery ceilings',
        audience: 'Households seeking calmer, lower-cost weekly food routines',
      },
    },
  ],
  SPREADSHEET: [
    {
      label: 'Sovereign Paycheck Allocation Model',
      tagline: 'Separates obligations, reserves, and safe daily spending on receipt.',
      fields: {
        title: 'Sovereign Paycheck & Allocation Model',
        prompt: 'Track incoming paychecks, fixed housing and utility commitments, emergency reserve transfers, and unallocated weekly cash',
        audience: 'Salaried professionals and young earners organizing monthly cashflow',
      },
    },
    {
      label: 'Studio P&L & Margin Ledger',
      tagline: 'Calculates true net margin after storefront fees and production costs.',
      fields: {
        title: 'Independent Studio Profit & Margin Ledger',
        prompt: 'Log digital edition unit sales, processor fees, software outlays, tax reserves, and monthly net operating profit',
        audience: 'Digital publishers, consultants, and solo studios',
      },
    },
    {
      label: 'Zero-Debt Horizon Tracker',
      tagline: 'Projects payoff dates across multiple obligations automatically.',
      fields: {
        title: 'Zero-Debt Horizon & Payoff Model',
        prompt: 'Compare loan principals, monthly rates, snowballed extra payments, and milestone payoff dates by account',
        audience: 'Earners systematically retiring personal or card debt',
      },
    },
    {
      label: 'Ceremony & Vendor Capital Sheet',
      tagline: 'Keeps wedding or milestone deposits aligned against hard ceilings.',
      fields: {
        title: 'Milestone Event & Vendor Allocation Sheet',
        prompt: 'Audit estimated vs contracted vendor fees, deposit schedules, venue allocations, and guest-tier totals',
        audience: 'Couples and independent event planners',
      },
    },
  ],
  PLANNER: [
    {
      label: 'Thirty Days of Quiet Momentum',
      tagline: 'Replaces scattered to-do lists with one anchor objective daily.',
      fields: {
        title: 'Thirty Days of Quiet Momentum',
        theme: 'One morning deep-work block, intentional spending discipline, and evening review',
      },
    },
    {
      label: 'Thesis & Examination Sprint',
      tagline: 'Structures thirty days of focused academic revision without burnout.',
      fields: {
        title: 'The Thirty-Day Examination & Deep Study Folio',
        theme: 'Active recall blocks, weak-subject triage, and protected sleep hours',
      },
    },
    {
      label: 'Intentional Capital 30-Day Cadence',
      tagline: 'Tracks discretionary pauses and weekly net savings momentum.',
      fields: {
        title: 'Intentional Capital: 30-Day Discipline Planner',
        theme: 'Daily zero-impulse streaks, trigger notes, and cumulative reserve tally',
      },
    },
    {
      label: 'Creator Editorial Dispatch',
      tagline: 'Aligns premise writing, visual packs, and release cadence weekly.',
      fields: {
        title: 'The Editorial Creator Release Planner',
        theme: 'Hook curation, studio batching, upload verification, and offer click tracking',
      },
    },
  ],
  JOURNAL: [
    {
      label: 'The Calm Ledger Reflection Edition',
      tagline: 'Pairs practical weekly cash audits with calm decision prompts.',
      fields: {
        title: 'The Calm Ledger Reflection Edition',
        journalType: 'Financial Clarity & Decision Workbook',
        topic: 'Weekly spending audits, emotional trigger awareness, and quarterly capital milestones',
      },
    },
    {
      label: 'The Sunday Evening Reset Folio',
      tagline: 'A fifteen-minute weekly ritual to enter Monday with composure.',
      fields: {
        title: 'The Sunday Evening Reset Folio',
        journalType: 'Executive Reflection Workbook',
        topic: 'Capturing weekly lessons, closing open mental loops, and selecting three deliberate Monday priorities',
      },
    },
    {
      label: 'Measured Courage Workbook',
      tagline: 'Helps quiet starters ship creative work without perfectionism.',
      fields: {
        title: 'Measured Courage: Thirty-Day Publishing Workbook',
        journalType: 'Creative Output Workbook',
        topic: 'Replacing hesitation with daily small drafts, feedback logs, and completed releases',
      },
    },
    {
      label: 'Stewardship & Gratitude Folio',
      tagline: 'Unites evening gratitude notes with steady long-term goals.',
      fields: {
        title: 'Stewardship & Daily Gratitude Folio',
        journalType: 'Mindful Capital Journal',
        topic: 'Three grounded daily reflections, one deliberate money decision, and calm evening closure',
      },
    },
  ],
  STORE_FUNNEL: [
    {
      label: "Quiet Compounder's Kit ($15)",
      tagline: 'High-trust finance bundle for Payhip or Selar.',
      fields: {
        productTitle: "The Quiet Compounder's Ledger & Allocation Kit",
        productSummary: 'An editorial PDF handbook and live Excel model that locates wasted cashflow and automates weekly reserves in 15 minutes.',
        targetAudience: 'Earners ready for clear control over every paycheck without complex jargon',
      },
    },
    {
      label: 'Examination & Focus Folio ($12)',
      tagline: 'Accessible student edition priced for rapid conversion.',
      fields: {
        productTitle: 'Thirty-Day Examination & Deep Study Folio',
        productSummary: 'A hyperlinked 30-day tablet and printable study planner engineered to turn scattered revision into calm daily output.',
        targetAudience: 'University students and certification candidates',
      },
    },
    {
      label: 'Creator Editorial Kit ($19)',
      tagline: 'Built for aspiring faceless channels wanting a polished start.',
      fields: {
        productTitle: 'The Faceless Editorial Hook & Launch Kit',
        productSummary: 'Fifty proven cold-open frameworks paired with a step-by-step release checklist for launching without appearing on camera.',
        targetAudience: 'Private beginners launching an authoritative faceless channel',
      },
    },
    {
      label: 'Pantry Economics Workbook ($12)',
      tagline: 'Tangible household savings proposition with immediate ROI.',
      fields: {
        productTitle: 'Pantry Economics Weekly Table & Budget Kit',
        productSummary: 'Structured weekly menu boards and automatic grocery tracking sheets designed to cut household food waste by 25%.',
        targetAudience: 'Busy households looking to lower recurring grocery bills',
      },
    },
  ],
  NOTEBOOKLM_CHANNEL: [
    {
      label: 'Meridian Ledger House',
      tagline: 'Authority finance essays paired with a $15 Excel & PDF bundle.',
      fields: {
        channelName: 'Meridian Ledger House',
        niche: 'Personal Finance & Capital Habits',
        targetAudience: 'Young professionals building six-month financial resilience',
        flagshipProduct: "The Quiet Compounder's Ledger ($15)",
      },
    },
    {
      label: 'Quiet Focus Press',
      tagline: 'Cognitive discipline essays funneling into a $12 planner.',
      fields: {
        channelName: 'Quiet Focus Press',
        niche: 'Deep Work & Study Architecture',
        targetAudience: 'Students and independent creators seeking structured focus',
        flagshipProduct: 'Thirty Days of Quiet Momentum ($12)',
      },
    },
    {
      label: 'Atelier Chronos',
      tagline: 'Cinema-grade historical storytelling with an illustrated monograph.',
      fields: {
        channelName: 'Atelier Chronos',
        niche: 'World & West African History Chronicles',
        targetAudience: 'Evening documentary listeners who value narrative depth',
        flagshipProduct: 'Forgotten Trade Empires Illustrated Edition ($14)',
      },
    },
    {
      label: 'Sovereign Editions Desk',
      tagline: 'Practical walkthroughs teaching clean $15 digital publishing.',
      fields: {
        channelName: 'Sovereign Editions Desk',
        niche: 'Digital Publishing & Independent Studios',
        targetAudience: 'First-time creators building lean local assets',
        flagshipProduct: 'First Edition in Forty-Eight Hours ($15)',
      },
    },
  ],
  PUBLISH_TOPIC: [
    {
      label: 'Three Silent Cashflow Leaks',
      tagline: 'High-trust curiosity premise anchored to a workbook offer.',
      fields: { titleOrTopic: 'Three Silent Cashflow Leaks Hiding Inside Everyday Bank Statements' },
    },
    {
      label: 'Building a Flagship $15 Edition',
      tagline: 'Behind-the-scenes studio walkthrough driving direct clicks.',
      fields: { titleOrTopic: 'How to Architect and Publish a Print-Grade $15 Digital Edition Locally' },
    },
    {
      label: 'Seven Mornings Without Reactive Feeds',
      tagline: 'Disciplined personal experiment with broad appeal.',
      fields: { titleOrTopic: 'I Replaced Morning Scrolling With Paper Allocation for Seven Days' },
    },
    {
      label: 'One Edition, Ten Focused Essays',
      tagline: 'Evergreen funnel architecture explained clearly.',
      fields: { titleOrTopic: 'Why One Thoughtful Digital Edition Beats Chasing Viral AdSense' },
    },
  ],
};

const CLICHE_BAN =
  'STRICT NAMING RULES: Never use tired cliché words like "Ultimate", "Mastery", "Unlock", "Game-Changer", "Quick Guide", "Secrets Revealed", "Hack", "Garden Gnome", or "Lost Treasure". Write crisp, publication-grade, distinguished titles that feel like a boutique imprint while remaining plain and approachable for complete beginners.';

export async function POST(req: NextRequest) {
  try {
    const body = IdeaRequestSchema.parse(await req.json());
    const mood = body.moodOrNiche?.trim() || 'Surprise Me';
    const seedHint = Math.floor(Math.random() * 9000 + 1000);

    const prompt = `Generate 4 distinctive, publication-grade creative concepts for a beginner student starting with a blank page.
Studio Category: ${body.category}
Editorial Direction: ${mood}
Freshness Seed: ${seedHint}

${CLICHE_BAN}

Requirements:
- Every title and premise must sound refined, specific, commercially credible, and immediately clear to a beginner.
- Return STRICT JSON ONLY matching this exact schema:
{
  "ideas": [
    {
      "label": "Short 2-5 word distinguished title",
      "tagline": "1 crisp active-voice sentence explaining why this works",
      "fields": ${FIELD_HINTS[body.category]}
    }
  ]
}`;

    try {
      const res = await generateWithRouter({
        taskType: 'fast_generation',
        prompt,
        systemPrompt:
          'You are a senior editorial director at an independent publishing and cinema studio helping beginners start with refined, non-generic concepts. Return strict valid JSON only.',
        jsonMode: true,
        temperature: 0.85,
        maxOutputTokens: 1600,
      });
      const parsed = extractJsonFromText<{ ideas?: IdeaEntry[] }>(res.text);
      if (Array.isArray(parsed.ideas) && parsed.ideas.length > 0) {
        const sanitized = parsed.ideas.slice(0, 4).map((item, idx) => ({
          label: String(item.label || `Concept ${idx + 1}`),
          tagline: String(item.tagline || 'Curated studio starter concept'),
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
      // Seamless curated fallback bank so blank students never hit a dead end
    }

    const bank = [...(FALLBACK_BANK[body.category] ?? [])];
    for (let i = bank.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bank[i], bank[j]] = [bank[j], bank[i]];
    }
    return NextResponse.json({
      ideas: bank.slice(0, 4),
      provider: 'Curated Studio Bank',
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not generate ideas' },
      { status: 400 }
    );
  }
}
