import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { MEANING_FULL, DOMAIN_DESC, SUBCAT_DESC, DISTINCTION_PAIRS, SPONTANEITY_DELIBERATENESS_NOTE } from "./descriptions.js";

const ses = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const ddb = DynamoDBDocumentClient.from(ddbClient);

const COUPLE_TABLE = "svq-couple-submissions";
const CLINICIAN_EMAIL = process.env.CLINICIAN_EMAIL;
const FROM_EMAIL = process.env.FROM_EMAIL;
// NEW — required for AI narration. Must be added as a Vercel environment variable;
// does not exist yet as of this file's creation. Get a key from console.anthropic.com.
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// ── GAP TAG TEXT ──────────────────────────────────────────────────────────────
function gapText(gapScore) {
  return gapScore >= 2
    ? "This value matters to you and may not be getting the space it needs right now."
    : "This value is active in your life right now.";
}

// ── CLIENT EMAIL HTML ─────────────────────────────────────────────────────────
function buildClientEmail(payload) {
  const { respondent, rankedMeanings, rankedDomains, topSubcats } = payload;
  const name = respondent.name || "there";
  const top = rankedMeanings[0];
  const top2dom = rankedDomains;

  const meaningRows = rankedMeanings.map((m, i) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#888;font-size:13px;width:24px;">${i + 1}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">
        <div style="font-weight:600;color:#1a2744;font-size:15px;">Sex as ${m.meaning}</div>
        <div style="font-size:13px;color:#555;margin-top:2px;">${m.impScore}% agreement</div>
        <div style="font-size:13px;color:#777;margin-top:4px;line-height:1.5;">${m.shortDescription || ''}</div>
      </td>
    </tr>`).join('');

  const domainSections = top2dom.map((d, i) => {
    const subcats = topSubcats[d.domain] || [];
    const subcatHTML = subcats.map(sc => `
      <div style="margin-bottom:16px;">
        <div style="font-weight:600;color:#1a2744;font-size:15px;margin-bottom:4px;">${sc.subcat}</div>
        <div style="font-size:14px;color:#444;margin-bottom:6px;">${sc.description || ''}</div>
        <div style="display:inline-block;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:500;
          background:${sc.gapScore >= 2 ? '#fff3e0' : '#e8f5e9'};
          color:${sc.gapScore >= 2 ? '#b8882a' : '#2e7d32'};">
          ${gapText(sc.gapScore)}
        </div>
      </div>`).join('');

    return `
      <div style="background:#f9f9f9;border-radius:8px;padding:20px;margin-bottom:16px;">
        <div style="font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Domain ${i + 1}</div>
        <div style="font-size:20px;font-weight:700;color:#1a2744;font-family:Georgia,serif;margin-bottom:8px;">${d.domain}</div>
        ${d.description ? `<div style="font-size:14px;color:#555;line-height:1.6;margin-bottom:14px;">${d.description}</div>` : ''}
        ${subcatHTML}
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Your Sexual Values Quiz Results</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">

        <!-- Header -->
        <tr><td style="background:#1a2744;padding:32px 36px;">
          <div style="font-size:11px;font-weight:600;color:#d4aa70;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">Sexual Values Quiz</div>
          <div style="font-size:26px;font-weight:700;color:#ffffff;font-family:Georgia,serif;">Your Results</div>
          ${respondent.name ? `<div style="font-size:14px;color:#aab4cc;margin-top:6px;">${respondent.name}</div>` : ''}
        </td></tr>

        <!-- Orientation -->
        <tr><td style="padding:28px 36px 0;">
          <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 8px;">
            Your results are organized in three layers: your top sexual value, your top two domains, and the specific sub-categories within each domain where your values are sharpest.
          </p>
          <p style="font-size:14px;color:#555;line-height:1.6;margin:0;">
            These results are a starting point. Bring them into your next session with your therapist.
          </p>
        </td></tr>

        <!-- Top Meaning -->
        <tr><td style="padding:28px 36px 0;">
          <div style="font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">Your top sexual value</div>
          <div style="background:#1a2744;border-radius:10px;padding:24px;">
            <div style="font-size:11px;color:#d4aa70;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Top meaning</div>
            <div style="font-size:22px;font-weight:700;color:#ffffff;font-family:Georgia,serif;margin-bottom:4px;">Sex as ${top.meaning}</div>
            <div style="font-size:28px;font-weight:700;color:#d4aa70;margin-bottom:12px;">${top.impScore}%</div>
            <div style="font-size:14px;color:#ccd2df;line-height:1.65;">${top.fullDescription || ''}</div>
          </div>
        </td></tr>

        <!-- All Meanings Ranked -->
        <tr><td style="padding:24px 36px 0;">
          <div style="font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">All your meanings, ranked</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;">
            ${meaningRows}
          </table>
        </td></tr>

        <!-- Top Domains -->
        <tr><td style="padding:24px 36px 0;">
          <div style="font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">Your top domains</div>
          ${domainSections}
        </td></tr>

        <!-- Booking CTA -->
        <tr><td style="padding:24px 36px 0;">
          <div style="text-align:center;padding:24px;background:#f9f9f9;border-radius:10px;">
            <p style="font-size:15px;color:#1a2744;font-weight:600;margin:0 0 16px;">Ready to talk through your results?</p>
            <a href="https://hannah-wood-kraft.clientsecure.me/" style="display:inline-block;padding:14px 28px;background:#d4aa70;color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;border-radius:6px;">Book a session to talk</a>
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 36px 32px;border-top:1px solid #eee;margin-top:24px;">
          <p style="font-size:12px;color:#999;line-height:1.6;margin:0;">
            This assessment was completed as part of your work with your therapist. Results are confidential and have also been shared with your clinician.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── CLINICIAN EMAIL HTML ──────────────────────────────────────────────────────
function buildClinicianEmail(payload) {
  const { respondent, rankedMeanings, rankedDomains, topSubcats, scScores, clinicianFlags, securityAroundAttraction, submittedAt, subcatDescs, domainDescs } = payload;

  const gapColor = (g) => g >= 2 ? '#c0392b' : '#27ae60';
  const gapLabel = (g) => g >= 2 ? 'Gap' : 'Met';

  // All meanings
  const meaningRows = rankedMeanings.map((m, i) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#888;font-size:13px;width:24px;">${i + 1}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">
        <div style="font-weight:600;color:#1a2744;font-size:15px;">Sex as ${m.meaning}</div>
        <div style="font-size:13px;color:#555;margin-top:2px;">${m.shortDescription || ''}</div>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;text-align:right;font-weight:600;color:#1a2744;">${m.impScore}%</td>
    </tr>`).join('');

  // Domains + subcats (ALL subcats per domain, not just top)
  const domainSections = rankedDomains.map((d, i) => {
    const allSubcats = Object.entries(scScores || {})
      .filter(([, s]) => s.domain === d.domain)
      .sort(([, a], [, b]) => b.rankingScore - a.rankingScore);

    const subcatRows = allSubcats.map(([sc, s]) => `
      <tr>
        <td style="padding:7px 12px;border-bottom:1px solid #f0f0f0;">
          <div style="font-size:14px;font-weight:600;color:#333;">${sc}</div>
          ${subcatDescs && subcatDescs[sc] ? `<div style="font-size:12px;color:#777;line-height:1.5;margin-top:2px;">${subcatDescs[sc]}</div>` : ''}
        </td>
        <td style="padding:7px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;text-align:right;font-weight:600;color:#1a2744;vertical-align:top;">${Math.round((s.impScore / 5) * 100)}%</td>
        <td style="padding:7px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:right;font-weight:700;color:${gapColor(s.gapScore)};vertical-align:top;">${gapLabel(s.gapScore)} (${s.gapScore > 0 ? '+' : ''}${s.gapScore.toFixed(2)})</td>
      </tr>`).join('');

    return `
      <div style="background:#f9f9f9;border-radius:8px;padding:20px;margin-bottom:16px;">
        <div style="font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">Domain ${i + 1}</div>
        <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:6px;">
          <div style="font-size:18px;font-weight:700;color:#1a2744;font-family:Georgia,serif;">${d.domain}</div>
          <div style="font-size:16px;font-weight:700;color:#d4aa70;">${Math.round((d.score / 5) * 100)}%</div>
        </div>
        ${domainDescs && domainDescs[d.domain] ? `<div style="font-size:13px;color:#555;line-height:1.55;margin-bottom:12px;">${domainDescs[d.domain]}</div>` : ''}
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e8e8;border-radius:6px;overflow:hidden;background:#fff;">
          <tr style="background:#f0f0f0;">
            <td style="padding:6px 12px;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;">Sub-category</td>
            <td style="padding:6px 12px;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;text-align:right;">Agreement</td>
            <td style="padding:6px 12px;font-size:11px;font-weight:700;color:#888;text-transform:uppercase;text-align:right;">Gap</td>
          </tr>
          ${subcatRows}
        </table>
      </div>`;
  }).join('');

  // Clinician flags
  const flags = clinicianFlags || {};
  const flagHTML = `
    <tr><td style="padding:7px 10px;border-bottom:1px solid #eee;font-weight:600;font-size:13px;">Meaning divergence</td>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:13px;">${flags.meaningDivergence ? `Yes — ${flags.meaningDivergenceNote || ''}` : 'No'}</td></tr>
    <tr><td style="padding:7px 10px;border-bottom:1px solid #eee;font-weight:600;font-size:13px;">High importance / high gap subcats</td>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:13px;">${flags.highImportanceHighGap?.length ? flags.highImportanceHighGap.join(', ') : 'None'}</td></tr>
    <tr><td style="padding:7px 10px;border-bottom:1px solid #eee;font-weight:600;font-size:13px;">Exclusivity vs Feeling Safe divergence</td>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:13px;">${flags.exclusivityFeelinSafeDivergence ? 'Yes' : 'No'}</td></tr>
    <tr><td style="padding:7px 10px;border-bottom:1px solid #eee;font-weight:600;font-size:13px;">Spontaneity + Deliberateness both high</td>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:13px;">${flags.spontaneityDeliberatenessBothHigh ? 'Yes' : 'No'}</td></tr>
    <tr><td style="padding:7px 10px;font-weight:600;font-size:13px;">Security-around-attraction subscale</td>
      <td style="padding:7px 10px;font-size:13px;">${securityAroundAttraction ?? 'N/A'}</td></tr>`;

  const coupleNote = respondent.coupleCode
    ? `<tr><td style="padding:7px 10px;border-bottom:1px solid #eee;font-weight:600;">Couple code</td><td style="padding:7px 10px;border-bottom:1px solid #eee;">${respondent.coupleCode}</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>SVQ Clinician Report</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#fff;border-radius:12px;overflow:hidden;">

        <!-- Header -->
        <tr><td style="background:#1a2744;padding:24px 32px;">
          <div style="font-size:11px;color:#d4aa70;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">SVQ Clinician Report</div>
          <div style="font-size:22px;font-weight:700;color:#fff;font-family:Georgia,serif;">Full Results — ${respondent.name || 'Anonymous'}</div>
          <div style="font-size:13px;color:#aab4cc;margin-top:4px;">${submittedAt || ''} &nbsp;·&nbsp; ${respondent.email}</div>
        </td></tr>

        <tr><td style="padding:24px 32px 0;">

          <!-- Clinician Flags -->
          <div style="font-size:13px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px;">Clinician Flags</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:6px;margin-bottom:24px;">
            ${flagHTML}
            ${coupleNote}
          </table>

          <!-- All Meanings -->
          <div style="font-size:13px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px;">All Meanings (ranked)</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin-bottom:24px;">
            ${meaningRows}
          </table>

          <!-- Domains + Sub-categories -->
          <div style="font-size:13px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:12px;">Domains and Sub-categories</div>
          ${domainSections}

        </td></tr>

        <tr><td style="padding:16px 32px 24px;border-top:1px solid #eee;">
          <p style="font-size:12px;color:#999;margin:0;">SVQ — confidential clinical data.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── COUPLE CODE / DYNAMODB HELPERS ─────────────────────────────────────────────
// Table: svq-couple-submissions
// Partition key: coupleCode (string)   Sort key: email (string)

async function getExistingSubmissions(coupleCode) {
  const result = await ddb.send(new QueryCommand({
    TableName: COUPLE_TABLE,
    KeyConditionExpression: "coupleCode = :cc",
    ExpressionAttributeValues: { ":cc": coupleCode },
  }));
  return result.Items || [];
}

async function saveCoupleSubmission(coupleCode, payload) {
  const { respondent, rankedMeanings, rankedDomains, topSubcats } = payload;
  await ddb.send(new PutCommand({
    TableName: COUPLE_TABLE,
    Item: {
      coupleCode,
      email: respondent.email,
      name: respondent.name || "",
      submittedAt: payload.submittedAt,
      rankedMeanings,
      rankedDomains,
      topSubcats,
    },
  }));
}

// ── AI NARRATION (added 2026-07-01) ─────────────────────────────────────────
// Takes the deterministic comparison facts and turns them into warm prose.
// Full behavior spec: SVQ_NarrationPrompt_2026-07-01_1345.md — this string
// must be kept in sync with that file if the rules ever change.
const NARRATION_SYSTEM_PROMPT = `You are writing narration for a couple's sexual values comparison email, on behalf of a licensed sex therapist. You do not decide what counts as overlap. You are given pre-computed facts about where two partners' quiz results overlap, along with clinical descriptions of each overlapping item and, where applicable, gap agreement status. Your only job is to turn those facts into warm, clinically grounded prose, plus conversation starters.

VOICE RULES: Plain, warm, informative third person. Speak in terms of "people who..." or "for couples who share this..." — never "you" in narration paragraphs (reserve "you" for conversation starters only). No em dashes. No contrast framing ("not X, but Y"). No hedging phrases ("in some ways," "can often"). No lead-ins like "for many people." No paired opposites for rhythm. Sentences direct and declarative. Tone: a knowledgeable clinician speaking plainly, not a wellness brand. Never repeat the same verb twice in one sentence for effect.

RANK LANGUAGE — CRITICAL: Never imply one partner values something more than the other. Only exception: when both partners share the exact same #1 (bothRankedFirst: true), use the clearest, most direct language ("X is the top meaning/domain for both of you"). Otherwise, state only that something is shared within the relevant top-N ("X shows up in both of your top meanings" / "X is in both of your top 2 domains"). Sub-category overlaps can say "you both lead with X."

GAP AGREEMENT: When gapAgreement is "met" or "unmet" (not null), add exactly one gentle sentence reflecting that shared status, in the couple's warm register (e.g. "This is something that already feels present for both of you right now" for met, or "This may not be getting quite the space it needs for either of you right now, worth bringing into a session together" for unmet). When gapAgreement is null, say nothing about gap for that item. Domains never receive gap language.

STRUCTURE: Return ONLY valid JSON, no markdown fences, no preamble, in exactly this shape:
{
  "meaningsNarration": "string or null if no shared meanings",
  "meaningsStarter": "string or null",
  "domainsNarration": "string or null if no shared domains",
  "subcatsNarration": { "DomainName": "string" } or null if no shared sub-categories,
  "subcatsStarter": "string or null"
}
Use null (not empty string) for any section with nothing to say.

MEANINGS BLOCK: Use each shared meaning's FULL description as grounding material, not just its name. Apply rank language rules. Fold in gap agreement sentence where applicable. If multiple meanings shared, connect in flowing prose. End with exactly one conversation starter, randomly prefixed with one of these three phrases (pick one, never reuse elsewhere in this response): "Something to talk through together:", "One place to start:", "Bring this into a conversation:". The question must be concrete and answerable, not abstract.

DOMAINS BLOCK: Use domain descriptions as grounding material. No conversation starter, ever. No gap language, ever. Apply rank language rules.

SUB-CATEGORIES BLOCK: Only for domains with shared sub-categories. Use each sub-category's description as grounding material. Fold in gap agreement sentences where applicable. Weave multiple sub-cats per domain into one paragraph. End the entire block (not per-domain) with exactly one conversation starter, randomly prefixed as above and different from whichever phrase was used in the meanings block, focused on one or two of the strongest overlaps. Respect any distinction notes provided — never narrate clinically distinct constructs as redundant.

STRUCTURAL NOTE: Connection domain only has 3 sub-categories vs 5 elsewhere, so it will always produce at least one shared sub-category when it's a shared domain. Do not narrate this as remarkable.

NEVER: invent facts not in the input; use "you" in narration paragraphs; imply relative weight between partners except the bothRankedFirst exception; mention gap when gapAgreement is null; mention gap in the domains block; treat distinct constructs as redundant; use empty string instead of null; repeat a starter phrase twice in one response.`;

function buildNarrationFacts(comparison) {
  const sharedMeanings = comparison.sharedMeanings.map(m => ({
    name: m.meaning,
    bothRankedFirst: m.bothRankedFirst,
    gapAgreement: m.gapAgreement,
    description: MEANING_FULL[m.meaning] || "",
  }));

  const sharedDomains = comparison.sharedDomains.map(d => ({
    name: d.domain,
    bothRankedFirst: d.bothRankedFirst,
    description: DOMAIN_DESC[d.domain] || "",
  }));

  const sharedSubcatsByDomain = {};
  Object.entries(comparison.sharedSubcatsByDomain || {}).forEach(([domain, subs]) => {
    sharedSubcatsByDomain[domain] = subs.map(s => ({
      name: s.subcat,
      gapAgreement: s.gapAgreement,
      description: SUBCAT_DESC[s.subcat] || "",
    }));
  });

  // Collect any distinction notes relevant to this specific couple's overlaps
  const allOverlapNames = [
    ...sharedMeanings.map(m => m.name),
    ...Object.values(sharedSubcatsByDomain).flat().map(s => s.name),
  ];
  const distinctionNotes = DISTINCTION_PAIRS
    .filter(pair => pair.items.every(item => allOverlapNames.includes(item)))
    .map(pair => pair.note);

  // Doc 4 clinician flag — safe, normalizing note if both appear together
  const hasSpontaneity = allOverlapNames.includes("Spontaneity");
  const hasDeliberateness = allOverlapNames.includes("Deliberateness");
  if (hasSpontaneity && hasDeliberateness) {
    distinctionNotes.push(SPONTANEITY_DELIBERATENESS_NOTE);
  }

  return { sharedMeanings, sharedDomains, sharedSubcatsByDomain, distinctionNotes };
}

async function getNarration(comparison) {
  if (!ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not set — cannot generate narration');
    return null;
  }

  const facts = buildNarrationFacts(comparison);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: NARRATION_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: JSON.stringify(facts) },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Anthropic API error:', response.status, errText);
    return null;
  }

  const data = await response.json();
  const textBlock = (data.content || []).find(b => b.type === 'text');
  if (!textBlock) {
    console.error('No text block in Anthropic API response');
    return null;
  }

  try {
    const cleaned = textBlock.text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (parseErr) {
    console.error('Failed to parse narration JSON:', parseErr, textBlock.text);
    return null;
  }
}


// Rules (locked 2026-06-30, extended 2026-07-01):
//   Meanings: top 3 each, any shared meaning counts, #1-matches-#1 is "strongest"
//   Domains: top 2 each, rank-agnostic — shared at any rank counts, same rank is "strongest"
//   Sub-categories: only compared within a domain BOTH partners have in their top 2,
//     regardless of which rank each partner had that domain at
//   Gap agreement (added 2026-07-01, for AI narration prompt): for shared meanings and
//     shared sub-categories only — never domains, which have no gap concept — check
//     whether both partners' gap status matches (met/unmet, threshold 2+ = unmet,
//     1 or less = met, per locked scoring rules). "met"/"unmet" if both agree, null if
//     they diverge or gap data is missing. Narration must stay silent on gap when null.
function gapStatus(gapScore) {
  if (typeof gapScore !== 'number' || Number.isNaN(gapScore)) return null;
  return gapScore >= 2 ? 'unmet' : 'met';
}

function compareGapAgreement(gapScoreA, gapScoreB) {
  const statusA = gapStatus(gapScoreA);
  const statusB = gapStatus(gapScoreB);
  if (statusA === null || statusB === null) return null;
  return statusA === statusB ? statusA : null; // null when they disagree
}

function computeComparison(partnerA, partnerB) {
  const meaningsA = (partnerA.rankedMeanings || []).slice(0, 3);
  const meaningsB = (partnerB.rankedMeanings || []).slice(0, 3);
  const sharedMeanings = [];
  meaningsA.forEach((mA, idxA) => {
    const idxB = meaningsB.findIndex(mB => mB.meaning === mA.meaning);
    if (idxB !== -1) {
      const mB = meaningsB[idxB];
      sharedMeanings.push({
        meaning: mA.meaning,
        rankA: idxA + 1,
        rankB: idxB + 1,
        sameRank: idxA === idxB,
        bothRankedFirst: idxA === 0 && idxB === 0,
        gapAgreement: compareGapAgreement(mA.gapScore, mB.gapScore),
      });
    }
  });

  const domainsA = (partnerA.rankedDomains || []).slice(0, 2);
  const domainsB = (partnerB.rankedDomains || []).slice(0, 2);
  const sharedDomains = [];
  domainsA.forEach((dA, idxA) => {
    const idxB = domainsB.findIndex(dB => dB.domain === dA.domain);
    if (idxB !== -1) {
      sharedDomains.push({
        domain: dA.domain,
        rankA: idxA + 1,
        rankB: idxB + 1,
        sameRank: idxA === idxB,
        bothRankedFirst: idxA === 0 && idxB === 0,
        // No gapAgreement here — domains have no gap concept, never gap-checked.
      });
    }
  });

  const sharedSubcatsByDomain = {};
  sharedDomains.forEach(({ domain }) => {
    const subA = (partnerA.topSubcats && partnerA.topSubcats[domain]) || [];
    const subB = (partnerB.topSubcats && partnerB.topSubcats[domain]) || [];
    const shared = subA
      .filter(sA => subB.some(sB => sB.subcat === sA.subcat))
      .map(sA => {
        const sB = subB.find(s => s.subcat === sA.subcat);
        return {
          subcat: sA.subcat,
          gapAgreement: compareGapAgreement(sA.gapScore, sB.gapScore),
        };
      });
    if (shared.length) sharedSubcatsByDomain[domain] = shared;
  });

  const hasAnyOverlap = sharedMeanings.length > 0 || sharedDomains.length > 0;

  return { sharedMeanings, sharedDomains, sharedSubcatsByDomain, hasAnyOverlap };
}

// Handles the couple-code side of a submission. Returns a status object so the
// handler can decide what (if anything) to do next. Does NOT send any email —
// individual results emails already sent by this point regardless of couple code.
async function handleCoupleCode(payload) {
  const coupleCode = payload.respondent?.coupleCode?.trim();
  if (!coupleCode) {
    return { coupleCode: null, status: "no_code" };
  }

  const existing = await getExistingSubmissions(coupleCode);
  const alreadySubmitted = existing.find(item => item.email === payload.respondent.email);

  if (!alreadySubmitted && existing.length >= 2) {
    // Code already has two other people on it. Front-end should have blocked
    // this before quiz start, but this is the backend safety net. We do NOT
    // throw — the person's own results email has already sent successfully,
    // this only affects the couple comparison, which will not run.
    console.warn(`Couple code ${coupleCode} rejected: already has ${existing.length} submissions`);
    return { coupleCode, status: "code_locked" };
  }

  await saveCoupleSubmission(coupleCode, payload);

  const updated = alreadySubmitted
    ? existing // resubmission under same email, count unchanged
    : [...existing, { email: payload.respondent.email }];

  if (updated.length >= 2) {
    // Both partners have submitted. Pull the two full records and run the
    // deterministic comparison, then generate AI narration if there's overlap.
    // Comparison email template and row deletion are the next unbuilt pieces
    // (see Doc 1, Couple Code Phase, build queue items 2-3).
    const finalRecords = await getExistingSubmissions(coupleCode);
    if (finalRecords.length >= 2) {
      const [partnerA, partnerB] = finalRecords;
      const comparison = computeComparison(partnerA, partnerB);
      console.log(`Couple code ${coupleCode} comparison computed:`, JSON.stringify(comparison));

      let narration = null;
      if (comparison.hasAnyOverlap) {
        narration = await getNarration(comparison);
        if (narration) {
          console.log(`Couple code ${coupleCode} narration generated:`, JSON.stringify(narration));
        } else {
          console.error(`Couple code ${coupleCode} narration failed — comparison email not yet built, so no fallback needed here yet, but will be once that step exists`);
        }
      }

      return { coupleCode, status: "ready_for_comparison", comparison, narration };
    }
    return { coupleCode, status: "ready_for_comparison" };
  }

  return { coupleCode, status: "waiting_for_partner" };
}

// ── HANDLER ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const payload = req.body;
    const { respondent } = payload;

    if (!respondent?.email) {
      return res.status(400).json({ error: 'Respondent email required' });
    }

    payload.submittedAt = new Date().toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      dateStyle: 'full',
      timeStyle: 'short',
    });

    // Send client email — always sends, regardless of couple code
    await ses.send(new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: { ToAddresses: [respondent.email] },
      Message: {
        Subject: { Data: 'Your Sexual Values Quiz Results', Charset: 'UTF-8' },
        Body: { Html: { Data: buildClientEmail(payload), Charset: 'UTF-8' } },
      },
    }));

    // Send clinician email — always sends, regardless of couple code
    await ses.send(new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: { ToAddresses: [CLINICIAN_EMAIL] },
      Message: {
        Subject: { Data: `SVQ Results — ${respondent.name || respondent.email} — ${payload.submittedAt}`, Charset: 'UTF-8' },
        Body: { Html: { Data: buildClinicianEmail(payload), Charset: 'UTF-8' } },
      },
    }));

    // Couple code handling — never blocks or affects the emails above.
    // If this fails for any reason, the person's own results still went
    // through; we log the error but do not fail the request.
    let coupleStatus = { status: "no_code" };
    if (respondent.coupleCode) {
      try {
        coupleStatus = await handleCoupleCode(payload);
      } catch (coupleErr) {
        console.error('Couple code handling error (individual emails already sent):', coupleErr);
        coupleStatus = { status: "error", detail: coupleErr.message };
      }
    }

    return res.status(200).json({ ok: true, couple: coupleStatus });

  } catch (err) {
    console.error('SVQ submit error:', err);
    return res.status(500).json({ error: 'Email delivery failed', detail: err.message });
  }
}
