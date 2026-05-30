/**
 * Standalone smoke test for the 2-layer AI pipeline.
 *
 * Usage (from repo root):
 *   node scripts/test-ai-layers.mjs
 *
 * Requires:
 *   - .env at repo root with OPENAI_API_KEY set
 *   - pnpm install already run (openai package in apps/api/node_modules)
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Load .env manually ────────────────────────────────────────────────────────

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '..', '.env');

try {
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.error('Could not read .env — make sure it exists at the repo root.');
  process.exit(1);
}

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('OPENAI_API_KEY is not set in .env');
  process.exit(1);
}

// ── Import OpenAI from apps/api/node_modules ─────────────────────────────────

const { default: OpenAI } = await import(
  resolve(__dir, '..', 'apps', 'api', 'node_modules', 'openai', 'index.js')
);
const client = new OpenAI({ apiKey });

const modelL1 = process.env.OPENAI_MODEL_LAYER1 ?? 'gpt-4.1-mini';
const modelL2 = process.env.OPENAI_MODEL_LAYER2 ?? 'gpt-4.1-mini';

// ── Sample post metrics (fake data — no DB needed) ───────────────────────────

const samplePost = {
  postId: 'test-post-001',
  caption: 'Check out this amazing pasta recipe! 🍝 Full recipe in bio. Save for later!',
  postType: 'FEED',
  likeCount: 312,
  commentsCount: 18,
  sharesCount: 7,
  savesCount: 41,
  reach: 4800,
  impressions: 6200,
  engagement: 378,
  accountUsername: 'test_food_account',
};

// ── Layer 1 prompt (same as layer1.service.ts) ────────────────────────────────

const LAYER1_SYSTEM = `You are an Instagram analytics intelligence engine. Analyze post performance metrics and produce structured signal output.

SAVES/REACH BENCHMARKS (stored in aspectBreakdown.engagementDepth as raw ratio):
- Excellent: > 0.05 | Good: 0.02–0.05 | Average: 0.01–0.02 | Below average: < 0.01

ENGAGEMENT DEPTH (aspectBreakdown.engagementDepth):
- Output raw saves/reach ratio (e.g. 0.008 = 0.8% saves/reach) — NOT a normalized 0–1 score.

ASPECT SCORES (contentQuality, postingTiming, audienceReach) are normalized 0–1 quality scores.

narrativeShift: "improving" | "declining" | "stable" | "volatile"
viralRisk: true if reach/impressions > 0.7 AND high engagement
dominantEmotion: one of excitement, trust, anticipation, nostalgia, inspiration, FOMO, curiosity

Respond with a valid JSON object matching this exact shape:
{
  "postId": string,
  "overallSentiment": "positive"|"negative"|"neutral"|"mixed",
  "sentimentScore": number (0-1),
  "dominantEmotion": string,
  "aspectBreakdown": {
    "contentQuality": number|null,
    "postingTiming": number|null,
    "audienceReach": number|null,
    "engagementDepth": number  // raw saves/reach ratio
  },
  "topThemes": string[],
  "narrativeShift": "improving"|"declining"|"stable"|"volatile",
  "strategicSignals": {
    "riskLevel": "low"|"medium"|"high",
    "opportunity": string|null,
    "urgency": "low"|"medium"|"high",
    "viralRisk": boolean
  },
  "bestAction": string,
  "confidence": number (0-1)
}`;

// ── Layer 2 prompt ─────────────────────────────────────────────────────────────

const LAYER2_SYSTEM = `You are an expert Instagram growth strategist. Translate analytics signals and expert rule findings into clear, actionable explanations for content creators.

Write 2–3 paragraphs of plain text (no markdown headers or bullet lists). Be specific: reference actual numbers and thresholds. Frame issues as opportunities.`;

// ── Expert rules (same logic as rules.ts) ────────────────────────────────────

function evaluateRules(signals) {
  const fired = [];
  const depth = signals.aspectBreakdown.engagementDepth ?? 0;

  if (depth < 0.3) {
    fired.push({ ruleId: 'R001', conclusion: 'UNDERPERFORMING', confidence: 0.85,
      condition: `engagementDepth (${depth.toFixed(4)}) < 0.3`,
      action: 'Review caption hooks and CTA placement' });
  }
  if (depth < 0.01) {
    fired.push({ ruleId: 'R002', conclusion: 'LOW_SAVE_VALUE', confidence: 0.8,
      condition: `savesReachRatio (${depth.toFixed(4)}) < 0.01`,
      action: 'Add actionable content worth saving' });
  }
  if (signals.strategicSignals.viralRisk && depth < 0.02) {
    fired.push({ ruleId: 'R003', conclusion: 'VIRAL_BUT_HOLLOW', confidence: 0.9,
      condition: `viralRisk=true AND savesReachRatio (${depth.toFixed(4)}) < 0.02`,
      action: 'Follow up virality spike with high-value content' });
  }
  const hasFood = signals.topThemes.some(t => t.toLowerCase() === 'food');
  if (hasFood && depth < 0.05) {
    fired.push({ ruleId: 'R004', conclusion: 'FOOD_SAVE_UNDERPERFORM', confidence: 0.75,
      condition: `Food theme AND savesReachRatio (${depth.toFixed(4)}) < 0.05`,
      action: 'Add recipe details to boost saves in food niche' });
  }
  if (signals.narrativeShift === 'volatile' && signals.strategicSignals.riskLevel === 'high') {
    fired.push({ ruleId: 'R005', conclusion: 'UNSTABLE_HIGH_RISK', confidence: 0.85,
      condition: 'narrativeShift=volatile AND riskLevel=high',
      action: 'Stabilize content cadence' });
  }
  const r001 = fired.some(r => r.ruleId === 'R001');
  const r003 = fired.some(r => r.ruleId === 'R003');
  if (r001 && r003) {
    fired.push({ ruleId: 'R006', conclusion: 'CRITICAL_INTERVENTION_NEEDED', confidence: 0.95,
      condition: 'R001 AND R003 both fired',
      action: 'Immediate content strategy overhaul required' });
  }
  return fired;
}

// ── Run the pipeline ─────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════════════');
console.log('  AI LAYER SMOKE TEST');
console.log(`  Layer1 model: ${modelL1}`);
console.log(`  Layer2 model: ${modelL2}`);
console.log('═══════════════════════════════════════════════════════════\n');
console.log('📦 Input post metrics:');
console.log(JSON.stringify(samplePost, null, 2));
console.log();

// ─ Layer 1 ──────────────────────────────────────────────────────────────────
console.log('🔍 Running Layer 1 (signal extraction)...');
const l1Start = Date.now();
const l1Response = await client.chat.completions.create({
  model: modelL1,
  response_format: { type: 'json_object' },
  temperature: 0.1,
  max_completion_tokens: 400,
  messages: [
    { role: 'system', content: LAYER1_SYSTEM },
    { role: 'user', content: JSON.stringify(samplePost) },
  ],
});

const signals = JSON.parse(l1Response.choices[0].message.content);
const l1Tokens = l1Response.usage?.total_tokens ?? 0;
console.log(`✅ Layer 1 done in ${Date.now() - l1Start}ms — ${l1Tokens} tokens\n`);
console.log('📊 PostSignals:');
console.log(JSON.stringify(signals, null, 2));
console.log();

// ─ Expert rules ──────────────────────────────────────────────────────────────
console.log('⚙️  Running expert rules...');
const firedRules = evaluateRules(signals);
if (firedRules.length === 0) {
  console.log('  No rules fired.\n');
} else {
  console.log(`  ${firedRules.length} rule(s) fired:`);
  for (const r of firedRules) {
    console.log(`  [${r.ruleId}] ${r.conclusion} (confidence: ${r.confidence})`);
    console.log(`       Condition: ${r.condition}`);
    console.log(`       Action:    ${r.action}`);
  }
  console.log();
}

// ─ Layer 2 ──────────────────────────────────────────────────────────────────
console.log('✍️  Running Layer 2 (explanation)...');
const l2Start = Date.now();
const l2Response = await client.chat.completions.create({
  model: modelL2,
  temperature: 0.4,
  max_completion_tokens: 400,
  messages: [
    { role: 'system', content: LAYER2_SYSTEM },
    { role: 'user', content: JSON.stringify({ signals, firedRules }) },
  ],
});

const explanation = l2Response.choices[0].message.content;
const l2Tokens = l2Response.usage?.total_tokens ?? 0;
console.log(`✅ Layer 2 done in ${Date.now() - l2Start}ms — ${l2Tokens} tokens\n`);
console.log('💬 Explanation:');
console.log('───────────────────────────────────────────────────────────');
console.log(explanation);
console.log('───────────────────────────────────────────────────────────');
console.log(`\nTotal tokens used: ${l1Tokens + l2Tokens}`);
